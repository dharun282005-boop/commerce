import { randomUUID } from 'node:crypto';
import {
  amazonOfficialApi,
  createFixtureAdapters,
  flipkartOfficialApi,
  GuardedAdapter,
  ManualImportAdapter,
  OndcAdapter,
  UserSubmittedAdapter,
  type Resolver,
  type SubmissionStore,
  MemoryCache,
  parseFixtureFailures,
  policyFromEnv,
  type Cache,
  type HistoryStore,
  type Offer,
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
import { coreRoutes } from './routes/core.ts';
import { dataRoutes } from './routes/data.ts';
import { createServices, type Services } from './services.ts';

export interface AppDeps {
  config: Config;
  cache?: Cache;
  /** Records observed prices (Postgres). Optional so the API also runs without a database. */
  recordObservations?: (offers: Offer[]) => Promise<unknown>;
  history?: HistoryStore;
  pingDb?: () => Promise<boolean>;
  pingRedis?: () => Promise<boolean>;
  /** Extra adapters (Phase D: imports, user submissions, ONDC). Fixture adapters are always included. */
  adapters?: SourceAdapter[];
  now?: () => Date;
  submissionStore?: SubmissionStore;
  /** DNS resolver for the SSRF guard (tests inject a fake). */
  resolver?: Resolver;
  /** Lets later phases register more routes with access to the shared services. */
  plugins?: Array<(app: FastifyInstance, ctx: { services: Services; metrics: Metrics }) => Promise<void>>;
}

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
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-api-key"]',
              'req.headers["x-admin-token"]',
            ],
          },
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    },
    bodyLimit: 256 * 1024,
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
        description:
          'Compare offers across platforms in Chennai. Runs on sample (fixture) data unless real sources are approved.',
        version: '0.2.0',
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUI, { routePrefix: '/docs' });

  const policy = policyFromEnv(config);
  const cache = deps.cache ?? new MemoryCache();
  const importer = new ManualImportAdapter(config.IMPORT_DIR ?? null);
  const userSubmitted = new UserSubmittedAdapter(deps.submissionStore, deps.resolver, now);
  const localSources = new Set([importer.id, userSubmitted.id]);
  const adapters = [
    ...createFixtureAdapters({ failures: parseFixtureFailures(config.FIXTURE_FAIL) }),
    importer,
    userSubmitted,
    new OndcAdapter(config.ONDC_GATEWAY_URL ?? null),
    amazonOfficialApi(),
    flipkartOfficialApi(),
    ...(deps.adapters ?? []),
  ];
  const guarded = adapters.map(
    (a) =>
      new GuardedAdapter(a, {
        policy,
        cache,
        // Local data changes when someone imports or submits, so it is never cached.
        cacheTtlMs: localSources.has(a.id) ? 0 : undefined,
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

  const services = createServices({
    sources: guarded,
    history: deps.history,
    recordObservations: deps.recordObservations,
    now,
    onWarn: (msg, err) => app.log.warn({ err }, msg),
  });

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
        fixtureMode: guarded
          .filter((g) => g.isAllowed().allowed)
          .every((g) => g.adapter.compliance.tier === 'fixture' || g.adapter.compliance.tier === 3),
      };
    },
  );

  app.get('/metrics', { schema: { tags: ['ops'], hide: true } }, async (_req, reply) => {
    reply.type('text/plain; version=0.0.4');
    return metrics.render();
  });

  await app.register(coreRoutes, { services, metrics });
  await app.register(dataRoutes, { importer, userSubmitted, config, now, metrics });
  for (const plugin of deps.plugins ?? []) await plugin(app, { services, metrics });

  return app;
}
