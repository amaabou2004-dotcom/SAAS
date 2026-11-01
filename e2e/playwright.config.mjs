import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @saas/api dev',
      cwd: '..',
      url: 'http://127.0.0.1:3001/api/v1/health',
      env: { PORT: '3001' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @saas/web dev',
      cwd: '..',
      url: 'http://localhost:5173',
      env: { PORT: '5173' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
