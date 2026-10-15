import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { browserName: 'chromium', channel: 'chrome', headless: true },
  projects: [
    { name: 'frontend', testMatch: 'frontend.spec.ts', use: { baseURL: 'http://127.0.0.1:5173' } },
    { name: 'production', testMatch: 'production.spec.ts', use: { baseURL: 'http://127.0.0.1:5174' } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    { command: 'npm run preview -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: true },
  ],
  reporter: 'list',
});
