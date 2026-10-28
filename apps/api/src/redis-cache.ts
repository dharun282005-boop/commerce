import type { Cache } from '@cuc/core';
import { Redis } from 'ioredis';

/** Search cache in Redis so it survives restarts and can be shared by several API instances. */
export class RedisCache implements Cache {
  constructor(readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.client.set(key, value, 'PX', ttlMs);
  }
}
