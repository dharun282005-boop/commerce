import { describe, expect, it, vi } from 'vitest';
import { checkAllowed, GuardedAdapter, policyFromEnv, type GuardOptions } from '../src/adapters/guarded.ts';
import { MemoryCache } from '../src/adapters/resilience.ts';
import { ctx, FakeAdapter, query } from './helpers.ts';

function setup(adapter: FakeAdapter, extra: Partial<GuardOptions> = {}, env: Record<string, string> = {}) {
  let now = 1_000_000;
  const clock = () => now;
  const sleep = vi.fn(async (_ms: number) => {});
  const guarded = new GuardedAdapter(adapter, {
    policy: policyFromEnv(env),
    cache: new MemoryCache(clock),
    clock,
    sleep,
    random: () => 0.5,
    retries: 0,
    timeoutMs: 50,
    ...extra,
  });
  return { guarded, sleep, advance: (ms: number) => (now += ms) };
}

describe('compliance gate and kill switches', () => {
  it('does not call a source that is disabled by default', async () => {
    const a = new FakeAdapter();
    a.compliance = { ...a.compliance, enabledByDefault: false };
    const { guarded } = setup(a);
    const r = await guarded.search(query(), ctx());
    expect(r.status).toBe('disabled');
    expect(r.error?.message).toMatch(/owner approval/);
    expect(a.calls).toBe(0);
  });

  it('global kill switch blocks every source', async () => {
    const a = new FakeAdapter();
    const r = await setup(a, {}, { KILL_SWITCH_ALL: 'true' }).guarded.search(query(), ctx());
    expect(r.status).toBe('disabled');
    expect(a.calls).toBe(0);
  });

  it('per-source kill switch blocks only that source', () => {
    const a = new FakeAdapter([], 'a');
    const b = new FakeAdapter([], 'b');
    const policy = policyFromEnv({ DISABLED_SOURCES: 'a, x' });
    expect(checkAllowed(a, policy).allowed).toBe(false);
    expect(checkAllowed(b, policy).allowed).toBe(true);
  });

  it('kill switch wins over ENABLED_SOURCES', () => {
    const a = new FakeAdapter([], 'a');
    expect(checkAllowed(a, policyFromEnv({ ENABLED_SOURCES: 'a', DISABLED_SOURCES: 'a' })).allowed).toBe(
      false,
    );
  });

  it('a tier-4 source without robots.txt permission stays off even if enabled', () => {
    const a = new FakeAdapter([], 'scraper');
    a.compliance = { ...a.compliance, tier: 4, robotsAllowed: false, enabledByDefault: false };
    expect(checkAllowed(a, policyFromEnv({ ENABLED_SOURCES: 'scraper' })).allowed).toBe(false);
    a.compliance = { ...a.compliance, robotsAllowed: null };
    expect(checkAllowed(a, policyFromEnv({ ENABLED_SOURCES: 'scraper' })).allowed).toBe(false);
  });
});

describe('cache', () => {
  it('serves the second identical search from cache until the TTL ends', async () => {
    const a = new FakeAdapter();
    const { guarded, advance } = setup(a);
    const first = await guarded.search(query(), ctx());
    const second = await guarded.search(query(), ctx());
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.fetchedAt).toBe(first.fetchedAt);
    expect(a.calls).toBe(1);
    advance(10 * 60 * 1000 + 1); // shopping TTL is 10 minutes
    expect((await guarded.search(query(), ctx())).fromCache).toBe(false);
    expect(a.calls).toBe(2);
  });
});

describe('rate limit', () => {
  it('rejects calls once the bucket is empty', async () => {
    const a = new FakeAdapter();
    const { guarded } = setup(a, { rateLimit: { capacity: 2, refillPerSecond: 0 } });
    await guarded.search(query('a'), ctx());
    await guarded.search(query('b'), ctx());
    const third = await guarded.search(query('c'), ctx());
    expect(third.status).toBe('unavailable');
    expect(third.error?.kind).toBe('rate_limited');
    expect(a.calls).toBe(2);
  });
});

describe('timeout and retry', () => {
  it('times out a hanging source', async () => {
    const r = await setup(new FakeAdapter(['hang'])).guarded.search(query(), ctx());
    expect(r.status).toBe('unavailable');
    expect(r.error?.kind).toBe('timeout');
  });

  it('retries with full jitter and then succeeds', async () => {
    const a = new FakeAdapter(['fail', 'fail', 'ok']);
    const { guarded, sleep } = setup(a, { retries: 2, retryBaseMs: 100 });
    const r = await guarded.search(query(), ctx());
    expect(r.status).toBe('ok');
    expect(a.calls).toBe(3);
    // random() = 0.5 -> delays 0.5*100*2^0 = 50 and 0.5*100*2^1 = 100
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([50, 100]);
  });
});

describe('circuit breaker', () => {
  it('opens after repeated failures, then lets one trial call through after the cool-down', async () => {
    const a = new FakeAdapter(['fail', 'fail', 'ok']);
    const { guarded, advance } = setup(a, { breaker: { failureThreshold: 2, cooldownMs: 30_000 } });
    expect((await guarded.search(query('1'), ctx())).error?.kind).toBe('upstream_error');
    expect((await guarded.search(query('2'), ctx())).error?.kind).toBe('upstream_error');
    const blocked = await guarded.search(query('3'), ctx());
    expect(blocked.error?.kind).toBe('circuit_open');
    expect(a.calls).toBe(2);
    expect((await guarded.health()).breaker).toBe('open');

    advance(30_000);
    const trial = await guarded.search(query('4'), ctx());
    expect(trial.status).toBe('ok');
    expect((await guarded.health()).breaker).toBe('closed');
  });
});

describe('validation', () => {
  it('drops records that fail the canonical schema and counts them', async () => {
    const r = await setup(new FakeAdapter(['invalid'])).guarded.search(query(), ctx());
    expect(r.status).toBe('ok');
    expect(r.offers).toHaveLength(1);
    expect(r.droppedInvalid).toBe(1);
  });
});
