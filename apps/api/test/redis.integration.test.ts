import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { RedisCache } from '../src/redis-cache.ts';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
afterAll(async () => {
  await redis.quit();
});

describe('RedisCache (needs docker compose up -d redis)', () => {
  it('stores values with a TTL', async () => {
    const cache = new RedisCache(redis);
    await cache.set('test:cuc:key', 'value', 200);
    expect(await cache.get('test:cuc:key')).toBe('value');
    expect(await redis.pttl('test:cuc:key')).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 300));
    expect(await cache.get('test:cuc:key')).toBeNull();
  });
});
