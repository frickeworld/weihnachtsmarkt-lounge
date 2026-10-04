import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { login, mockBackoffice } from './support/mockBackoffice';

test.describe('Händler-Bereich', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackoffice(page, { role: 'haendler' });
    await page.goto('/login?next=%2Fhaendler');
    await login(page);
    await expect(page).toHaveURL(/\/haendler$/);
  });

  test('Übersicht mit „Euer Anteil“, ohne Umsatz und Studio-F-Anteil', async ({ page }) => {
    await expect(page.getByText('275,00 €')).toBeVisible();
    await expect(page.getByText('Euer Anteil', { exact: true })).toBeVisible();
    await expect(page.getByText(/Umsatz|Studio F/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Heute in der Lounge' })).toBeVisible();
  });

  test('Buchungen: Status, nicht erschienen, keine Aktions-Buttons', async ({ page }) => {
    await page.getByRole('link', { name: 'Buchungen' }).click();
    await expect(page.getByText('3 Buchungen')).toBeVisible();
    await expect(
      page.getByText('Nicht erschienen').filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('Storniert').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Einchecken|Stornieren|Ticket/ })).toHaveCount(0);
    await page.getByLabel('Status').selectOption('nicht_erschienen');
    await expect(page.getByText('1 Buchung', { exact: true })).toBeVisible();
  });

  test('Abrechnung: 275,00 €, CSV mit Summenzeile, PDF', async ({ page }) => {
    await page.getByRole('link', { name: 'Abrechnung' }).click();
    await expect(page.getByText('Summe (2 Buchungen)')).toBeVisible();
    await expect(page.getByText('Dies ist keine Rechnung.', { exact: false })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Gesamt' })).toHaveCount(0);
    const [csv] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'CSV (Excel)' }).click(),
    ]);
    const text = await readFile((await csv.path())!, 'utf8');
    expect(text.trimEnd().split('\r\n').at(-1)).toBe('Summe;;;2 Buchungen;;;;;275,00');
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'PDF herunterladen' }).click(),
    ]);
    expect(pdf.suggestedFilename()).toMatch(/^Abrechnung-Lounge_.*\.pdf$/);
    const bytes = await readFile((await pdf.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('Konto: 2FA freiwillig einrichten', async ({ page }) => {
    await page.getByRole('link', { name: 'Konto' }).click();
    await expect(page.getByRole('link', { name: 'Jetzt einrichten' })).toHaveAttribute(
      'href',
      '/login/2fa?einrichten=1&next=%2Fhaendler%2Fkonto',
    );
  });

  test('/scan verlangt die Scanner-PIN', async ({ page }) => {
    await page.goto('/scan');
    await expect(page.getByRole('heading', { name: 'PIN eingeben' })).toBeVisible();
  });
});

test('Admin sieht die Abrechnung mit Umsatz und Studio-F-Anteil', async ({ page }) => {
  await mockBackoffice(page, { hasFactor: true });
  await page.goto('/login?next=%2Fadmin%2Fabrechnung');
  await login(page);
  await page.getByLabel('6-stelliger Code').fill('123456');
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByText('Summe (2 Buchungen)')).toBeVisible();
  await expect(page.getByText('82,00 €')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Gesamt' })).toBeVisible();
});
