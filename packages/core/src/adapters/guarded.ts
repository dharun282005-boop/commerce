import { createHash } from 'node:crypto';
import { Offer, type SearchQuery, type Vertical } from '../schemas.ts';
import {
  backoffDelay,
  CircuitBreaker,
  realSleep,
  TokenBucket,
  type BreakerState,
  type Cache,
} from './resilience.ts';
import { SourceError, type SearchContext, type SourceAdapter, type SourceResult } from './types.ts';

/** How long search results stay cached, by vertical (brief §1). */
export const CACHE_TTL_MS: Record<Vertical, number> = {
  property: 6 * 60 * 60 * 1000, // hours: listings change slowly
  shopping: 10 * 60 * 1000, // minutes
  grocery: 5 * 60 * 1000,
  food: 90 * 1000, // 1–2 minutes: menus and ETAs change fast
};

/** Global and per-source switches, usually read from env (see .env.example). */
export interface SourcePolicy {
  killAll: boolean;
  disabled: ReadonlySet<string>;
  enabled: ReadonlySet<string>;
}

export function policyFromEnv(env: Record<string, string | undefined>): SourcePolicy {
  const list = (v: string | undefined) =>
    new Set(
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  return {
    killAll: env.KILL_SWITCH_ALL === 'true',
    disabled: list(env.DISABLED_SOURCES),
    enabled: list(env.ENABLED_SOURCES),
  };
}

/** The compliance gate. Order matters: kill switches win over everything. */
export function checkAllowed(adapter: SourceAdapter, policy: SourcePolicy): { allowed: boolean; reason: string } {
  const c = adapter.compliance;
  if (policy.killAll) return { allowed: false, reason: 'global kill switch is on' };
  if (policy.disabled.has(adapter.id)) return { allowed: false, reason: 'source switched off' };
  if (c.tier === 4 && c.robotsAllowed !== true) {
    return { allowed: false, reason: 'tier 4 source without robots.txt permission' };
  }
  if (c.enabledByDefault || policy.enabled.has(adapter.id)) return { allowed: true, reason: 'enabled' };
  return { allowed: false, reason: 'disabled by default (needs owner approval)' };
}

export interface GuardOptions {
  policy: SourcePolicy;
  cache: Cache;
  timeoutMs?: number;
  retries?: number;
  retryBaseMs?: number;
  rateLimit?: { capacity: number; refillPerSecond: number };
  breaker?: { failureThreshold: number; cooldownMs: number };
  clock?: () => number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (e: GuardEvent) => void;
}

export type GuardEvent =
  | { type: 'cache_hit' | 'cache_miss'; sourceId: string }
  | { type: 'result'; sourceId: string; status: SourceResult['status']; errorKind?: string };

export interface GuardedHealth {
  sourceId: string;
  breaker: BreakerState;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  adapter: { ok: boolean; detail?: string };
}

/**
 * Wraps a SourceAdapter with everything the brief requires around each call:
 * compliance gate → cache → rate limit → circuit breaker → timeout → retry with jitter → validation.
 * It never throws: every outcome becomes a SourceResult, so one source can't fail a whole search.
 */
export class GuardedAdapter {
  private bucket: TokenBucket;
  private breaker: CircuitBreaker;
  private clock: () => number;
  private lastSuccessAt: number | null = null;
  private lastErrorAt: number | null = null;
  private lastError: string | null = null;

  constructor(
    readonly adapter: SourceAdapter,
    private opts: GuardOptions,
  ) {
    this.clock = opts.clock ?? Date.now;
    const rl = opts.rateLimit ?? { capacity: 10, refillPerSecond: 5 };
    this.bucket = new TokenBucket(rl.capacity, rl.refillPerSecond, this.clock);
    const br = opts.breaker ?? { failureThreshold: 5, cooldownMs: 30_000 };
    this.breaker = new CircuitBreaker(br.failureThreshold, br.cooldownMs, this.clock);
  }

  get id() {
    return this.adapter.id;
  }

  isAllowed() {
    return checkAllowed(this.adapter, this.opts.policy);
  }

  async search(query: SearchQuery, ctx: SearchContext): Promise<SourceResult> {
    const started = this.clock();
    const base = {
      sourceId: this.adapter.id,
      sourceName: this.adapter.name,
      tier: this.adapter.compliance.tier,
    };
    const finish = (r: Omit<SourceResult, keyof typeof base | 'latencyMs'>): SourceResult => {
      const result = { ...base, ...r, latencyMs: this.clock() - started };
      this.opts.onEvent?.({
        type: 'result',
        sourceId: this.adapter.id,
        status: result.status,
        errorKind: result.error?.kind,
      });
      return result;
    };

    // 1. Compliance gate
    const gate = this.isAllowed();
    if (!gate.allowed) {
      return finish({
        status: 'disabled',
        offers: [],
        fromCache: false,
        fetchedAt: null,
        droppedInvalid: 0,
        error: { kind: 'disabled', message: gate.reason },
      });
    }

    // 2. Cache
    const key = cacheKey(this.adapter.id, query);
    const cached = await this.safeCacheGet(key);
    if (cached) {
      this.opts.onEvent?.({ type: 'cache_hit', sourceId: this.adapter.id });
      return finish({ status: 'ok', offers: cached.offers, fromCache: true, fetchedAt: cached.fetchedAt, droppedInvalid: 0 });
    }
    this.opts.onEvent?.({ type: 'cache_miss', sourceId: this.adapter.id });

    try {
      // 3. Rate limit and 4. circuit breaker
      if (!this.bucket.tryTake()) throw new SourceError('rate_limited', 'per-source rate limit reached');
      if (!this.breaker.canRequest()) throw new SourceError('circuit_open', 'source is cooling down after failures');

      // 5. Timeout + retry with jitter
      let raws;
      try {
        raws = await this.withRetry(() => this.withTimeout((signal) => this.adapter.search(query, { ...ctx, signal })));
        this.breaker.onSuccess();
      } catch (err) {
        this.breaker.onFailure();
        throw err;
      }

      // 6. Normalise + validate. Bad records are dropped and counted, never shown.
      const offers: Offer[] = [];
      let dropped = 0;
      for (const raw of raws) {
        try {
          const parsed = Offer.safeParse(this.adapter.normalise(raw, ctx));
          if (parsed.success) offers.push(parsed.data);
          else dropped++;
        } catch {
          dropped++;
        }
      }
      const fetchedAt = new Date(this.clock()).toISOString();
      await this.safeCacheSet(key, { offers, fetchedAt }, CACHE_TTL_MS[query.vertical]);
      this.lastSuccessAt = this.clock();
      return finish({ status: 'ok', offers, fromCache: false, fetchedAt, droppedInvalid: dropped });
    } catch (err) {
      const e =
        err instanceof SourceError ? err : new SourceError('upstream_error', err instanceof Error ? err.message : String(err));
      this.lastErrorAt = this.clock();
      this.lastError = `${e.kind}: ${e.message}`;
      return finish({
        status: 'unavailable',
        offers: [],
        fromCache: false,
        fetchedAt: null,
        droppedInvalid: 0,
        error: { kind: e.kind, message: e.message },
      });
    }
  }

  async health(): Promise<GuardedHealth> {
    let adapter: { ok: boolean; detail?: string };
    try {
      adapter = await this.adapter.health();
    } catch (err) {
      adapter = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
    const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
    return {
      sourceId: this.adapter.id,
      breaker: this.breaker.state,
      lastSuccessAt: iso(this.lastSuccessAt),
      lastErrorAt: iso(this.lastErrorAt),
      lastError: this.lastError,
      adapter,
    };
  }

  private async withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const ms = this.opts.timeoutMs ?? 3000;
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new SourceError('timeout', `no answer within ${ms} ms`, true));
      }, ms);
    });
    try {
      return await Promise.race([fn(controller.signal), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const retries = this.opts.retries ?? 2;
    const sleep = this.opts.sleep ?? realSleep;
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const retryable = !(err instanceof SourceError) || err.retryable;
        if (!retryable || attempt >= retries) throw err;
        await sleep(backoffDelay(attempt, this.opts.retryBaseMs ?? 100, this.opts.random));
      }
    }
  }

  // A cache outage should slow us down, not break search.
  private async safeCacheGet(key: string): Promise<{ offers: Offer[]; fetchedAt: string } | null> {
    try {
      const v = await this.opts.cache.get(key);
      return v ? (JSON.parse(v) as { offers: Offer[]; fetchedAt: string }) : null;
    } catch {
      return null;
    }
  }

  private async safeCacheSet(key: string, value: unknown, ttlMs: number) {
    try {
      await this.opts.cache.set(key, JSON.stringify(value), ttlMs);
    } catch {
      /* ignore cache errors */
    }
  }
}

/** Filters are applied after fetching, so they are not part of the key. */
export function cacheKey(sourceId: string, q: SearchQuery): string {
  const h = createHash('sha256')
    .update(JSON.stringify([q.vertical, q.q.toLowerCase(), [...q.pincodes].sort(), [...q.localityIds].sort()]))
    .digest('hex')
    .slice(0, 24);
  return `search:v1:${sourceId}:${h}`;
}
