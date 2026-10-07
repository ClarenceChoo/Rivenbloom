import { defineConfig, devices } from '@playwright/test';

const production = process.env.RIVENBLOOM_PRODUCTION === '1';

export default defineConfig({
  testMatch: production
    ? ['**/pwa-production.spec.ts', '**/production-journey.spec.ts']
    : '**/*.spec.ts',
  testIgnore: production ? [] : ['**/pwa-production.spec.ts', '**/production-journey.spec.ts'],
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 15_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    launchOptions: {
      executablePath: process.env.RIVENBLOOM_CHROMIUM_PATH,
      args: process.env.RIVENBLOOM_TEST_RENDERER === 'canvas' ? ['--disable-webgl'] : [],
    },
    baseURL: production ? 'http://127.0.0.1:4174' : 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: production
      ? 'npm run preview -- --host 127.0.0.1 --port 4174'
      : 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: production ? 'http://127.0.0.1:4174' : 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
