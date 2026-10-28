import { randomUUID } from 'node:crypto';
import {
  createFixtureAdapters,
  GuardedAdapter,
  MemoryCache,
  Offer,
  parseFixtureFailures,
  policyFromEnv,
  resolveArea,
  searchAll,
  searchLocalities,
  SearchFilters,
  Vertical,
  type Cache,
  type SourceAdapter,
} from '@cuc/core';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from './config.ts';
import { Metrics } from './metrics.ts';

export interface AppDeps {
  config: Config;
  cache?: Cache;
  /** Records observed prices (Postgres). Optional so the API also runs without a database. */
  recordObservations?: (offers: Offer[]) => Promise<unknown>;
  pingDb?: () => Promise<boolean>;
  pingRedis?: () => Promise<boolean>;
  adapters?: SourceAdapter[];
  now?: () => Date;
}

const SearchBody = z.object({
  vertical: Vertical,
  q: z.string().trim().min(1).max(200).describe('What to look for, e.g. "veg biryani"'),
  locality: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .describe('Chennai locality name, alias, corridor (OMR) or pincode'),
  filters: SearchFilters.default({}),
});

const SourceStatus = z.object({
  sourceId: z.string(),
  sourceName: z.string(),
  tier: z.union([z.number(), z.literal('fixture')]),
  status: z.enum(['ok', 'disabled', 'unavailable']),
  offerCount: z.number(),
  fromCache: z.boolean(),
  fetchedAt: z.string().nullable(),
  latencyMs: z.number(),
  droppedInvalid: z.number(),
  error: z.object({ kind: z.string(), message: z.string() }).optional(),
});

const SearchResponse = z.object({
  requestId: z.string(),
  vertical: Vertical,
  area: z.object({ label: z.string(), localityIds: z.array(z.string()), pincodes: z.array(z.string()) }),
  sampleData: z.boolean().describe('True when any offer comes from sample (fixture) data'),
  offers: z.array(Offer),
  sources: z.array(SourceStatus),
  generatedAt: z.string(),
});

const ErrorResponse = z.object({ error: z.string(), message: z.string() });

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const now = deps.now ?? (() => new Date());
  const metrics = new Metrics();

  const app = Fastify({
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : {
            level: config.LOG_LEVEL,
            // Rule 6: never log secrets or personal data. Bodies (which hold search text) are not logged.
            redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
          },
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });
  app.addHook('onResponse', async (req, reply) => {
    metrics.inc('http_requests_total', {
      route: req.routeOptions.url ?? 'unknown',
      status: String(reply.statusCode),
    });
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Chennai Universal Commerce API',
        description: 'Compare offers across platforms in Chennai. Phase B: fixture (sample) data only.',
        version: '0.1.0',
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUI, { routePrefix: '/docs' });

  const policy = policyFromEnv(config);
  const cache = deps.cache ?? new MemoryCache();
  const adapters =
    deps.adapters ?? createFixtureAdapters({ failures: parseFixtureFailures(config.FIXTURE_FAIL) });
  const guarded = adapters.map(
    (a) =>
      new GuardedAdapter(a, {
        policy,
        cache,
        onEvent: (e) => {
          if (e.type === 'result')
            metrics.inc('source_results_total', { source: e.sourceId, status: e.status });
          else
            metrics.inc('source_cache_total', {
              source: e.sourceId,
              result: e.type === 'cache_hit' ? 'hit' : 'miss',
            });
        },
      }),
  );

  app.get(
    '/health',
    {
      schema: {
        tags: ['ops'],
        response: {
          200: z.object({
            status: z.literal('ok'),
            db: z.enum(['up', 'down', 'disabled']),
            redis: z.enum(['up', 'down', 'disabled']),
            fixtureMode: z.boolean(),
          }),
        },
      },
    },
    async () => {
      const check = async (fn?: () => Promise<boolean>) => {
        if (!fn) return 'disabled' as const;
        try {
          return (await fn()) ? ('up' as const) : ('down' as const);
        } catch {
          return 'down' as const;
        }
      };
      return {
        status: 'ok' as const,
        db: await check(deps.pingDb),
        redis: await check(deps.pingRedis),
        fixtureMode: adapters.every((a) => a.compliance.tier === 'fixture'),
      };
    },
  );

  app.get('/metrics', { schema: { tags: ['ops'], hide: true } }, async (_req, reply) => {
    reply.type('text/plain; version=0.0.4');
    return metrics.render();
  });

  app.get(
    '/v1/localities',
    {
      schema: {
        tags: ['localities'],
        querystring: z.object({ q: z.string().max(60).optional() }),
        response: {
          200: z.object({
            localities: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                nameTa: z.string(),
                pincode: z.string(),
                lat: z.number(),
                lng: z.number(),
                zone: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (req) => ({
      localities: searchLocalities(req.query.q).map(({ aliases: _a, ...l }) => l),
    }),
  );

  app.get('/v1/sources', { schema: { tags: ['sources'] } }, async () => ({
    sources: await Promise.all(
      guarded.map(async (g) => ({
        id: g.adapter.id,
        name: g.adapter.name,
        verticals: g.adapter.capabilities.verticals,
        compliance: g.adapter.compliance,
        allowed: g.isAllowed(),
        health: await g.health(),
      })),
    ),
  }));

  app.post(
    '/v1/search',
    {
      schema: {
        tags: ['search'],
        body: SearchBody,
        response: { 200: SearchResponse, 404: ErrorResponse },
      },
    },
    async (req, reply) => {
      const { vertical, q, locality, filters } = req.body;
      const area = resolveArea(locality);
      if (!area) {
        return reply.code(404).send({
          error: 'unknown_locality',
          message: 'This app covers Chennai only. Try a locality name such as "Adyar" or a 6000xx pincode.',
        });
      }
      metrics.inc('searches_total', { vertical });
      const outcome = await searchAll(
        guarded,
        { vertical, q, filters, pincodes: area.pincodes, localityIds: area.localities.map((l) => l.id) },
        { requestId: req.id, now },
      );

      // Only fresh fetches are new observations; cached ones were recorded when first fetched.
      if (deps.recordObservations) {
        const fresh = new Set(
          outcome.sources.filter((s) => s.status === 'ok' && !s.fromCache).map((s) => s.sourceId),
        );
        const toRecord = outcome.offers.filter((o) => fresh.has(o.provenance.sourceId));
        deps
          .recordObservations(toRecord)
          .catch((err) => req.log.warn({ err }, 'failed to record observations'));
      }

      return {
        requestId: req.id,
        vertical,
        area: { label: area.label, localityIds: area.localities.map((l) => l.id), pincodes: area.pincodes },
        sampleData: outcome.offers.some((o) => o.provenance.isSample),
        offers: outcome.offers,
        sources: outcome.sources,
        generatedAt: now().toISOString(),
      };
    },
  );

  return app;
}
