import { expect, test } from '@playwright/test';
import { mockSupabase } from './support/mockSupabase';

for (const [path, heading, must] of [
  ['/impressum', 'Impressum', 'Angaben gemäß § 5 DDG'],
  ['/datenschutz', 'Datenschutzerklärung', 'Reichweitenmessung ohne Cookies'],
  ['/agb', 'Allgemeine Geschäftsbedingungen', 'Kein Widerrufsrecht, keine Stornierung'],
] as const) {
  test(`${heading}: Entwurf mit Vermerk und Inhalt`, async ({ page }) => {
    await mockSupabase(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('Entwurf – noch nicht freigegeben');
    await expect(page.getByText(must)).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(heading));
  });
}

test('AGB nennen Preise aus den Einstellungen', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/agb');
  await expect(page.getByText(/insgesamt 178,50\s€ je Buchung/)).toBeVisible();
});

test('Fehlerseite, wenn ein Seitenteil nach einem Update fehlt', async ({ page }) => {
  await mockSupabase(page);
  await page.route('**/assets/LoginRoutes-*.js', (route) => route.abort());
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Da ist etwas schiefgelaufen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seite neu laden' })).toBeVisible();
});

test('Startseite: strukturierte Daten mit Gesamtpreis', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');
  const json = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!,
  );
  expect(json.offers).toMatchObject({ price: '178.50', priceCurrency: 'EUR' });
});
