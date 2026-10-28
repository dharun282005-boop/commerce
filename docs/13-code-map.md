# 13 · Code map (as of Phase B)

```
.
├── PROMPT.md                     Owner's brief (source of truth for scope)
├── docker-compose.yml            postgres (pgvector:pg17) + redis:8 + api on :4100
├── package.json                  npm workspaces + root scripts (ci, test, lint, db:*)
├── vitest.config.ts              two test projects: unit (no Docker) and integration
├── packages/core/                Pure TypeScript, no I/O except fixtures
│   ├── src/money.ts              paise helpers, Indian number formatting
│   ├── src/units.ts              "2 kg" → 2000 g, price per 100 g
│   ├── src/schemas.ts            Zod canonical Offer (4 verticals), SearchQuery, filters
│   ├── src/localities.ts         22 Chennai localities + OMR corridor, resolveArea()
│   ├── src/text.ts               tokenizer used by fixture search
│   ├── src/search.ts             searchAll(): fan out, isolate failures, filter, sort
│   ├── src/adapters/types.ts     SourceAdapter, Compliance, SourceResult, SourceError
│   ├── src/adapters/resilience.ts  MemoryCache, TokenBucket, CircuitBreaker, backoff
│   ├── src/adapters/guarded.ts   GuardedAdapter: gate → cache → rate limit → breaker → timeout → retry → validate
│   ├── src/adapters/fixture.ts   FixtureAdapter + FIXTURE_FAIL simulation
│   └── src/fixtures/*.ts         sample data: sources, shopping, food, grocery, property
├── packages/db/                  Postgres via Drizzle
│   ├── src/schema.ts             localities, sources, offers, price_observations
│   ├── migrations/0000…0002      extensions, tables (generated), append-only trigger
│   ├── src/observations.ts       ObservationStore.record(): upsert snapshot + append history
│   ├── src/seed.ts               loads localities, sources, one snapshot of every fixture
│   └── src/migrate.ts            applies migrations
└── apps/api/                     Fastify HTTP service
    ├── src/app.ts                routes: /health /metrics /v1/localities /v1/sources /v1/search, OpenAPI at /docs
    ├── src/server.ts             wiring: Redis cache, Postgres, migrate+seed on start, graceful shutdown
    ├── src/config.ts             env parsing (Zod)
    ├── src/redis-cache.ts        Cache implementation on Redis (PX TTL)
    ├── src/metrics.ts            Prometheus-style counters
    └── Dockerfile                node:24-alpine, runs with tsx
```

Tests sit next to each package in `test/`. `*.integration.test.ts` files need Docker.
