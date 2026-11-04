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

test('Impressum nennt Verkäufer und Veranstalter', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/impressum');
  const main = page.getByRole('main');
  await expect(main).toContainText('MF Coaching & Promotion GmbH');
  await expect(main).toContainText('Vertreten durch den Geschäftsführer: Oliver Fricke');
  await expect(main).toContainText('DE248046234');
  await expect(
    page.getByRole('heading', { name: 'Gastgeber und Veranstalter der Lounge' }),
  ).toBeVisible();
  await expect(main).toContainText('Werbegemeinschaft Detmold e. V.');
  await expect(main).toContainText('Vereinsregister Amtsgericht Lemgo, VR 60389');
});

test('AGB nennen die Preisstaffel aus der Datenbank', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/agb');
  await expect(
    page.getByText(/Zum Lounge-Preis kommt eine Verarbeitungsgebühr von 5 % des Lounge-Preises/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Montag bis Donnerstag, Früher Abend \(16:45–18:45 Uhr\): Lounge-Preis 149,00\s€, Gesamtpreis 156,00\s€ inkl\. Verarbeitungsgebühr und 75 € Freiverzehr/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Freitag und Samstag, Später Abend \(20:00–22:00 Uhr\): Lounge-Preis 199,00\s€, Gesamtpreis 209,00\s€ inkl\. Verarbeitungsgebühr und 100 € Freiverzehr/,
    ),
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
    lowPrice: '104.00',
    highPrice: '209.00',
    priceCurrency: 'EUR',
  });
});
