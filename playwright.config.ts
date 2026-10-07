import { defineConfig, devices } from '@playwright/test';

const production = process.env.RIVENBLOOM_PRODUCTION === '1';
const browser = process.env.RIVENBLOOM_BROWSER ?? 'chromium';
if (!['chromium', 'firefox', 'webkit', 'all'].includes(browser)) {
  throw new Error('RIVENBLOOM_BROWSER must be chromium, firefox, webkit or all.');
}

export default defineConfig({
  testMatch: production ? '**/pwa-production.spec.ts' : '**/*.spec.ts',
  testIgnore: production ? [] : ['**/pwa-production.spec.ts'],
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 15_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: production ? 'http://127.0.0.1:4174' : 'http://127.0.0.1:4176',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.RIVENBLOOM_SOAK === '1' ? undefined : 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
    },
  ].filter(({ name }) => browser === 'all' || name === `${browser}-desktop`),
  webServer: {
    command: production
      ? 'npm run preview -- --host 127.0.0.1 --port 4174'
      : 'RIVENBLOOM_TEST=1 npm run dev -- --host 127.0.0.1 --port 4176',
    url: production ? 'http://127.0.0.1:4174' : 'http://127.0.0.1:4176',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
