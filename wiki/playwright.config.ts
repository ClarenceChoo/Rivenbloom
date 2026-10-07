import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4191', viewport: { width: 1536, height: 1024 } },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4191',
    reuseExistingServer: !process.env.CI,
  },
});
