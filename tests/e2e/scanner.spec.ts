import { expect, test } from '@playwright/test';
import { enterPin, login, mockScanner, newMock } from './support/mockScanner';

test.describe('Scanner', () => {
  test('falsche PIN, dann Anmeldung; noindex', async ({ page }) => {
    const mock = newMock();
    await mockScanner(page, mock);
    await page.goto('/scan');
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await enterPin(page, '111111');
    await expect(page.getByRole('alert')).toHaveText('PIN falsch. Noch 4 Versuche.');
    await enterPin(page, '482915');
    await expect(page.getByRole('button', { name: /Heute \(0\/1\)/ })).toBeVisible();
  });

  test('Code eingeben → grün, Taler übergeben → nochmal gelb', async ({ page }) => {
    const mock = newMock();
    await mockScanner(page, mock);
    await login(page);
    await page.getByLabel('Buchungscode von Hand eingeben').fill('hl abcd efgh');
    await page.getByRole('button', { name: 'Prüfen' }).click();
    const sheet = page.getByRole('alertdialog');
    await expect(
      sheet.getByRole('heading', { name: 'Gültig – herzlich willkommen!' }),
    ).toBeVisible();
    await expect(sheet.getByText('Anna Muster')).toBeVisible();
    await expect(sheet.getByText('Residenztaler noch nicht übergeben')).toBeVisible();
    await sheet.getByRole('button', { name: 'Taler übergeben' }).click();
    await expect(sheet.getByText(/Residenztaler übergeben um/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Weiter scannen' }).click();

    await page.getByLabel('Buchungscode von Hand eingeben').fill('HL-ABCD-EFGH');
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('heading', { name: 'Bereits eingecheckt' })).toBeVisible();
  });

  test('anderer Termin → orange, „Trotzdem einchecken“', async ({ page }) => {
    const mock = newMock({ nextResult: 'wrong_slot' });
    await mockScanner(page, mock);
    await login(page);
    await page.getByLabel('Buchungscode von Hand eingeben').fill('HL-ABCD-EFGH');
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('heading', { name: 'Anderer Termin' })).toBeVisible();
    await page.getByRole('button', { name: 'Trotzdem einchecken' }).click();
    await expect(page.getByRole('heading', { name: 'Eingecheckt (anderer Termin)' })).toBeVisible();
    expect(mock.requests.filter((r) => r.action === 'scan').map((r) => r.override)).toEqual([
      false,
      true,
    ]);
  });

  test('erfundener Code → rot; storniert in der Liste', async ({ page }) => {
    const mock = newMock();
    await mockScanner(page, mock);
    await login(page);
    await page.getByLabel('Buchungscode von Hand eingeben').fill('HL-XXXX-XXXX');
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('heading', { name: 'Ungültig' })).toBeVisible();
    await expect(page.getByText('Diesen Code gibt es nicht.')).toBeVisible();
    await page.getByRole('button', { name: 'Weiter scannen' }).click();
    await page.getByRole('button', { name: /Heute/ }).click();
    await expect(page.getByText('Storniert')).toBeVisible();
  });

  test('offline: Check-in mit gespeicherter Liste, Nachtrag bei Netzrückkehr', async ({ page }) => {
    const mock = newMock();
    await mockScanner(page, mock);
    await login(page);
    await page.getByRole('button', { name: /Heute \(0\/1\)/ }).waitFor();

    mock.offline = true;
    await page.getByLabel('Buchungscode von Hand eingeben').fill('HL-ABCD-EFGH');
    await page.getByRole('button', { name: 'Prüfen' }).click();
    const sheet = page.getByRole('alertdialog');
    await expect(
      sheet.getByRole('heading', { name: 'Gültig – herzlich willkommen!' }),
    ).toBeVisible();
    await expect(sheet.getByText('Offline geprüft – wird nachgetragen')).toBeVisible();
    await sheet.getByRole('button', { name: 'Weiter scannen' }).click();
    await expect(page.getByText(/Offline.*1 Eintrag wartet auf Übertragung/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Heute \(1\/1\)/ })).toBeVisible();

    mock.offline = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByRole('status').filter({ hasText: 'Online' })).toHaveText('Online');
    const synced = mock.requests.find((r) => r.action === 'scan');
    expect(synced).toMatchObject({ code: 'HL-ABCD-EFGH', offline: true });
    expect(typeof synced?.scannedAt).toBe('string');
  });
});
