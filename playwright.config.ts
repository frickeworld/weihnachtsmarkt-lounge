import { defineConfig, devices } from '@playwright/test';

// In der Claude-Cloud-Umgebung ist Chromium vorinstalliert (PW_CHROMIUM_PATH=/opt/pw-browsers/chromium/...).
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  // Fake-Kamera mit QR-Code für den Scanner-Test
  globalSetup: './tests/e2e/support/makeQrVideo.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
  ],
  webServer: {
    // Build mit Dummy-Supabase-URL: Die Tests simulieren die Datenbank-Funktionen per page.route.
    command:
      'VITE_SUPABASE_URL=http://supabase.test VITE_SUPABASE_ANON_KEY=e2e-anon-key npm run build && npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
