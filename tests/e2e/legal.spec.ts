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

test('AGB nennen die Preisstaffel aus der Datenbank', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/agb');
  await expect(
    page.getByText(/Endpreise je Lounge und enthalten eine Vorverkaufsgebühr von 3,50\s€/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Montag bis Donnerstag, Abend \(16:45–18:45 oder 19:00–21:00 Uhr\): 149,00\s€ inkl\. 75 € Freiverzehr/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Freitag und Samstag, Abend .*199,00\s€ inkl\. 100 € Freiverzehr/),
  ).toBeVisible();
});

test('Fehlerseite, wenn ein Seitenteil nach einem Update fehlt', async ({ page }) => {
  await mockSupabase(page);
  await page.route('**/assets/LoginRoutes-*.js', (route) => route.abort());
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Da ist etwas schiefgelaufen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seite neu laden' })).toBeVisible();
});

test('Startseite: strukturierte Daten mit Preisspanne', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');
  const json = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!,
  );
  expect(json.offers).toMatchObject({
    '@type': 'AggregateOffer',
    lowPrice: '149.00',
    highPrice: '199.00',
    priceCurrency: 'EUR',
  });
});
