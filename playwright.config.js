import { defineConfig, devices } from '@playwright/test';

// Point at the Chromium that's actually installed on this machine. Without
// `channel: 'chromium'` Playwright tries to launch its bundled "headless
// shell", which may be a different build number than what's on disk.
const launchOptions = {
  channel: 'chromium',
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
};

// Emulate a phone by default (the app is a phone-first experience).
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        baseURL: 'http://localhost:4173',
        viewport: { width: 390, height: 844 },
        launchOptions,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
