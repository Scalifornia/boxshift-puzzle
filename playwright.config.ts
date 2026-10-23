import { defineConfig, devices } from '@playwright/test';

const externalURL = process.env.PLAYWRIGHT_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.ts',
  fullyParallel: true,
  workers: 2,
  retries: isCI ? 1 : 0,
  timeout: isCI ? 90_000 : 30_000,
  expect: { timeout: isCI ? 15_000 : 7_000 },
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
      use: {
        ...devices['Desktop Safari'], viewport: { width: 1440, height: 960 },
        // Linux CI rasterizes Canvas in software. Keep the CSS viewport and
        // assertions while local WebKit continues to cover the preset's DPR 2.
        ...(isCI ? { deviceScaleFactor: 1 } : {}),
      },
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
