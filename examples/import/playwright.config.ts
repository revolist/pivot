import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.ts', timeout: 45_000, expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:49282', viewport: { width: 1440, height: 1000 }, colorScheme: 'light', trace: 'retain-on-failure' },
  webServer: { command: '../../node_modules/.bin/vite --host 127.0.0.1 --port 49282', url: 'http://127.0.0.1:49282', reuseExistingServer: true },
});
