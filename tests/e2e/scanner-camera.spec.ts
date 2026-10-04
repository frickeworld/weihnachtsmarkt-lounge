import { expect, test } from '@playwright/test';
import { QR_TOKEN, QR_VIDEO } from './support/makeQrVideo';
import { login, mockScanner, newMock } from './support/mockScanner';

// Fake-Kamera zeigt einen QR-Code (siehe support/makeQrVideo.ts)
test.use({
  permissions: ['camera'],
  launchOptions: {
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${QR_VIDEO}`,
    ],
  },
});

test('QR-Code vor der Kamera wird erkannt', async ({ page }) => {
  const mock = newMock();
  await mockScanner(page, mock);
  await login(page);
  await expect(page.getByRole('heading', { name: 'Gültig – herzlich willkommen!' })).toBeVisible({
    timeout: 15_000,
  });
  expect(mock.requests.find((r) => r.action === 'scan')).toMatchObject({ code: QR_TOKEN });
});
