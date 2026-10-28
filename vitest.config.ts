import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          // Tests must never call a paid model API, whatever is in the shell environment.
          env: { AGENT_PROVIDER: 'offline', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '' },
          include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
          exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['packages/*/test/**/*.integration.test.ts', 'apps/*/test/**/*.integration.test.ts'],
          testTimeout: 20000,
        },
      },
    ],
  },
});
