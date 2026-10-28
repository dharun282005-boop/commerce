import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  REDIS_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  KILL_SWITCH_ALL: z.string().optional(),
  DISABLED_SOURCES: z.string().optional(),
  ENABLED_SOURCES: z.string().optional(),
  FIXTURE_FAIL: z.string().optional(),
  SEED_ON_START: z.string().optional(),
  IMPORT_DIR: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  ONDC_GATEWAY_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  ONDC_MOCK: z.enum(['true', 'false']).default('true'),
  ADMIN_TOKEN: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  ALERT_SECRET: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  SMTP_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  WEB_ORIGIN: z.string().default('http://localhost:3100'),
  RATE_LIMIT: z.enum(['on', 'off']).default('on'),
  /** Swagger UI at /docs (off in serverless, where its static files are not available). */
  DOCS: z.enum(['on', 'off']).default('on'),
  /** Requests per minute per IP for ordinary routes (stricter limits apply to agent, submissions and alerts). */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  /** Set to "true" behind a reverse proxy so the client IP comes from X-Forwarded-For. */
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return Env.parse(env);
}
