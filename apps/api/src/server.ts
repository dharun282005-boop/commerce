import { createDb, MIGRATIONS_FOLDER, ObservationStore, PgHistoryStore, seed } from '@cuc/db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Redis } from 'ioredis';
import { buildApp, type AppDeps } from './app.ts';
import { loadConfig } from './config.ts';
import { RedisCache } from './redis-cache.ts';
import { PgAlertStore } from './alerts/store.ts';

const config = loadConfig();
// Default folder for owner-supplied data files (tier 3).
config.IMPORT_DIR ??= new URL('../../../data/imports', import.meta.url).pathname;
config.ONDC_GATEWAY_URL ??= `http://127.0.0.1:${config.PORT}/mock/ondc`;
const deps: AppDeps = { config };
const closers: Array<() => Promise<unknown>> = [];

if (config.REDIS_URL) {
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  redis.on('error', () => {}); // errors surface through /health and the cache wrapper
  deps.cache = new RedisCache(redis);
  deps.redis = redis;
  deps.pingRedis = async () => (await redis.ping()) === 'PONG';
  closers.push(() => redis.quit());
}

if (config.DATABASE_URL) {
  const { pool, db } = createDb(config.DATABASE_URL);
  if (config.SEED_ON_START === 'true') {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    await seed(config.DATABASE_URL);
  }
  const store = new ObservationStore(db);
  deps.recordObservations = (offers) => store.record(offers);
  deps.history = new PgHistoryStore(pool);
  deps.alertStore = new PgAlertStore(pool);
  deps.pingDb = async () => (await pool.query('select 1')).rowCount === 1;
  closers.push(() => pool.end());
}

const app = await buildApp(deps);

const shutdown = async () => {
  await app.close();
  await Promise.allSettled(closers.map((c) => c()));
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
