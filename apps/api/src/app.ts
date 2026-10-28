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
import { randomBytes } from 'node:crypto';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import type { Redis } from 'ioredis';
import { AlertService } from './alerts/service.ts';
import { MemoryAlertStore, type AlertStore } from './alerts/store.ts';
import { MemoryNotifier, SmtpNotifier, type Notifier } from './alerts/notify.ts';
import { alertRoutes } from './routes/alerts.ts';
import { coreRoutes } from './routes/core.ts';
import { dataRoutes } from './routes/data.ts';
import { agentRoutes } from './routes/agent.ts';
import { claudeFromEnv, type AgentModel } from './agent/models.ts';
import { ScriptedModel } from './agent/scripted.ts';
import type { AgentLimits } from './agent/loop.ts';
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
  alertStore?: AlertStore;
  /** Where logs go (tests capture them). Default: stdout. */
  logStream?: { write: (msg: string) => void };
  /** Shared Redis client: rate-limit counters live here when present (works across API instances). */
  redis?: Redis;
  notifier?: Notifier;
  /** Agent model; default: Claude if ANTHROPIC_MODEL + credentials are set, else the offline planner. */
  agentModel?: AgentModel;
  agentLimits?: Partial<AgentLimits>;
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
            ...(deps.logStream ? { stream: deps.logStream } : {}),
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
    trustProxy: config.TRUST_PROXY === 'true',
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

  // Security headers. The API serves JSON, so its CSP is "nothing may load"; /docs (Swagger UI) keeps
  // helmet's other headers but needs its own scripts and styles.
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  app.addHook('onSend', async (req, reply) => {
    if (!req.url.startsWith('/docs'))
      reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  });

  // Per-IP rate limits (brief §9). Expensive or abusable routes get tighter limits.
  const STRICT: Record<string, number> = {
    '/v1/agent': 30,
    '/v1/submissions': 10,
    '/v1/alerts': 5,
    '/v1/alerts/verify': 20,
    '/v1/admin/import': 20,
  };
  app.addHook('onRoute', (route) => {
    const max = STRICT[route.url];
    if (max)
      route.config = {
        ...(route.config as object),
        rateLimit: { max, timeWindow: '1 minute' },
      } as typeof route.config;
  });
  if (config.RATE_LIMIT === 'on') {
    await app.register(fastifyRateLimit, {
      global: true,
      max: config.RATE_LIMIT_MAX,
      timeWindow: '1 minute',
      ...(deps.redis ? { redis: deps.redis, nameSpace: 'cuc-rl:' } : {}),
      allowList: (req) => req.url === '/health' || req.url === '/metrics',
      errorResponseBuilder: (_req, ctx) => ({
        statusCode: 429,
        error: 'rate_limited',
        message: `Too many requests. Try again in ${ctx.after}.`,
      }),
    });
  }

  // The web app runs on its own origin; only it may call the API from a browser.
  await app.register(fastifyCors, {
    origin: config.WEB_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
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
        // Strict per-source limits protect real platforms; sample and local data need none.
        rateLimit:
          a.compliance.tier === 'fixture' || localSources.has(a.id)
            ? { capacity: 10_000, refillPerSecond: 10_000 }
            : { capacity: 10, refillPerSecond: 2 },
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

  if (!config.ALERT_SECRET && config.NODE_ENV === 'production') {
    app.log.warn('ALERT_SECRET is not set: alert links will stop working after a restart');
  }
  const notifier =
    deps.notifier ?? (config.SMTP_URL ? new SmtpNotifier(config.SMTP_URL) : new MemoryNotifier());
  const alerts = new AlertService({
    store: deps.alertStore ?? new MemoryAlertStore(),
    notifier,
    secret: config.ALERT_SECRET ?? randomBytes(32).toString('hex'),
    webOrigin: config.WEB_ORIGIN.split(',')[0]!.trim(),
    now,
  });

  const services = createServices({
    sources: guarded,
    history: deps.history,
    recordObservations: deps.recordObservations,
    now,
    onWarn: (msg, err) => app.log.warn({ err }, msg),
    onObserved: (offers) => alerts.check(offers),
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
        // True when no enabled source fetches real platform data (fixtures, own imports, user reports, mocks).
        fixtureMode: guarded
          .filter((g) => g.isAllowed().allowed)
          .every(
            (g) =>
              g.adapter.compliance.tier === 'fixture' ||
              g.adapter.compliance.tier === 3 ||
              g.adapter.id.endsWith('-mock'),
          ),
      };
    },
  );

  app.get('/metrics', { schema: { tags: ['ops'], hide: true } }, async (_req, reply) => {
    reply.type('text/plain; version=0.0.4');
    return metrics.render();
  });

  await app.register(coreRoutes, { services, metrics });
  await app.register(dataRoutes, { importer, userSubmitted, config, now, metrics });
  await app.register(alertRoutes, { alerts, services });
  const agentModel = deps.agentModel ?? claudeFromEnv() ?? new ScriptedModel();
  await app.register(agentRoutes, { services, metrics, model: agentModel, now, limits: deps.agentLimits });
  for (const plugin of deps.plugins ?? []) await plugin(app, { services, metrics });

  return app;
}
