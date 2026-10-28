import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the four headline user stories, the assistant, Tamil UI,
 * accessibility (axe), a mobile LCP check and offline saved items.
 * Starts the API (in-memory, no Docker needed) and the production web build.
 */
const API_PORT = 4199;
const WEB_PORT = 3199;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: `npx tsx ../api/src/server.ts`,
      url: `http://localhost:${API_PORT}/health`,
      env: {
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        DATABASE_URL: '',
        REDIS_URL: '',
        ANTHROPIC_API_KEY: '',
        ENABLED_SOURCES: '',
      },
      reuseExistingServer: !!process.env.PW_REUSE,
      timeout: 60_000,
    },
    {
      command: `npx next build && npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`, NEXT_TELEMETRY_DISABLED: '1' },
      reuseExistingServer: !!process.env.PW_REUSE,
      timeout: 240_000,
    },
  ],
});
