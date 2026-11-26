import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.GS_PORT ?? 5173);
const baseURL = `http://127.0.0.1:${port}`;

const known = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
} as const;
type BrowserName = keyof typeof known;

const requested = (process.env.GS_BROWSERS ?? 'chromium')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s): s is BrowserName => s in known);
const browsers: BrowserName[] = requested.length > 0 ? requested : ['chromium'];
const externalServer = process.env.GS_NO_WEBSERVER === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: browsers.map((name) => ({ name, use: { ...known[name] } })),
  ...(externalServer
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});
