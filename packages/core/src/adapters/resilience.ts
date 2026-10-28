/** Small, dependency-free building blocks used by GuardedAdapter. Each takes an injectable clock. */

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

export class MemoryCache implements Cache {
  private store = new Map<string, { value: string; expiresAt: number }>();
  constructor(private now: () => number = Date.now) {}

  async get(key: string): Promise<string | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
  }
}

/** Token bucket: `capacity` calls at once, refilled at `refillPerSecond`. */
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(
    private capacity: number,
    private refillPerSecond: number,
    private now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  tryTake(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.refillPerSecond);
    this.last = t;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

export type BreakerState = 'closed' | 'open' | 'half_open';

/**
 * Circuit breaker. After `failureThreshold` consecutive failures it opens and rejects calls for
 * `cooldownMs`. Then it lets one trial call through (half-open): success closes it, failure re-opens it.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private _state: BreakerState = 'closed';
  private trialInFlight = false;

  constructor(
    private failureThreshold = 5,
    private cooldownMs = 30_000,
    private now: () => number = Date.now,
  ) {}

  get state(): BreakerState {
    if (this._state === 'open' && this.now() - this.openedAt >= this.cooldownMs) {
      this._state = 'half_open';
      this.trialInFlight = false;
    }
    return this._state;
  }

  canRequest(): boolean {
    const s = this.state;
    if (s === 'closed') return true;
    if (s === 'half_open' && !this.trialInFlight) {
      this.trialInFlight = true;
      return true;
    }
    return false;
  }

  onSuccess(): void {
    this.failures = 0;
    this._state = 'closed';
    this.trialInFlight = false;
  }

  onFailure(): void {
    this.failures += 1;
    if (this._state === 'half_open' || this.failures >= this.failureThreshold) {
      this._state = 'open';
      this.openedAt = this.now();
      this.trialInFlight = false;
    }
  }
}

/** Full-jitter exponential backoff: random delay in [0, base * 2^attempt]. */
export function backoffDelay(attempt: number, baseMs: number, random: () => number = Math.random): number {
  return Math.floor(random() * baseMs * 2 ** attempt);
}

export const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
