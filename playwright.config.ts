import { defineConfig, devices } from '@playwright/test';

const externalURL = process.env.PLAYWRIGHT_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.ts',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalURL ?? 'http://127.0.0.1:4173',
    locale: 'pt-PT',
    timezoneId: 'Europe/Luxembourg',
    serviceWorkers: 'allow',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 },
        launchOptions: executablePath ? { executablePath } : {},
      },
      grepInvert: /touch controls/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], launchOptions: executablePath ? { executablePath } : {} },
      grep: /touch controls/,
    },
    {
      name: 'desktop-webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 960 } },
      grepInvert: /touch controls/,
    },
  ],
  webServer: externalURL ? undefined : {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
