import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the four headline user stories, the assistant, Tamil UI,
 * accessibility (axe), a mobile LCP check and offline saved items.
 * Runs the production build with the API embedded at /api — the same setup Vercel serves.
 * The assistant is pinned to the offline planner so tests never call a paid model API.
 */
const WEB_PORT = 3199;

export default defineConfig({
  testDir: './e2e',
  testIgnore: /zz-/,
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx next build && npx next start --port ${WEB_PORT}`,
    url: `http://localhost:${WEB_PORT}/en`,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      AGENT_PROVIDER: 'offline',
      NEXT_PUBLIC_API_URL: '',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    },
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
