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
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return Env.parse(env);
}
