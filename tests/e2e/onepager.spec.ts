import { expect, test } from '@playwright/test';

test.describe('One-Pager', () => {
  test('zeigt Gesamtpreis groß und ohne Kaminfeuer-Versprechen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#preis')).toContainText('178,50 €');
    await expect(page.locator('#preis')).toContainText('inkl. 3,50 € Vorverkaufsgebühr');
    await expect(page.locator('body')).not.toContainText('Kaminfeuer');
  });

  test('Anker springen zu den richtigen Abschnitten', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Jetzt Lounge buchen' }).click();
    await expect(page).toHaveURL(/#buchen$/);
    await expect(page.locator('#buchen')).toBeInViewport();
    await page.goto('/');
    await page.getByRole('link', { name: 'Was dich erwartet' }).click();
    await expect(page.locator('#erlebnis')).toBeInViewport();
    await page.getByRole('link', { name: 'Termin wählen' }).click();
    await expect(page.locator('#buchen')).toBeInViewport();
  });

  test('Buchungs-UI: Tag, Zeitfenster, Formular mit Validierung', async ({ page }) => {
    await page.goto('/#buchen');
    const day = page.locator('#buchen table button:not([disabled])').first();
    await day.click();
    const slot = page
      .getByRole('group', { name: 'Zeitfenster' })
      .locator('button:not([disabled])')
      .first();
    await slot.click();

    const submit = page.getByRole('button', { name: /Zahlungspflichtig buchen – 178,50 €/ });
    await submit.click();
    await expect(page.getByText('Bitte gib deinen Vornamen an.')).toBeVisible();
    await expect(page.getByText('Bitte bestätige die AGB und die Verbindlichkeit.')).toBeVisible();

    // Rechnungsadresse erscheint erst bei Firma oder Rechnungswunsch
    await expect(page.getByLabel('PLZ')).toHaveCount(0);
    await page.getByLabel('Firmenname (optional)').fill('Muster GmbH');
    await expect(page.getByLabel('PLZ')).toBeVisible();

    await page.getByLabel('Vorname').fill('Anna');
    await page.getByLabel('Nachname').fill('Muster');
    await page.getByLabel('E-Mail').fill('anna@example.de');
    await page.getByLabel('Telefon').fill('05231 123456');
    await page.getByLabel('Personenzahl').selectOption('8');
    await page.locator('#buchen label').filter({ hasText: 'Firmenfeier' }).click();
    await expect(page.getByRole('radio', { name: 'Firmenfeier' })).toBeChecked();
    await page.getByLabel('Straße und Hausnummer').fill('Schloßplatz 1');
    await page.getByLabel('PLZ').fill('32756');
    await page.getByLabel('Ort').fill('Detmold');
    const newsletter = page.getByLabel(/STUDIO\/F-Newsletter/);
    await expect(newsletter).not.toBeChecked();
    await page.getByLabel(/Ich akzeptiere die/).check();
    await submit.click();
    await expect(page.getByRole('status')).toContainText('Online-Zahlung wird gerade eingerichtet');
  });

  test('Rechtsseiten und 404 erreichbar', async ({ page }) => {
    for (const [path, title] of [
      ['/impressum', 'Impressum'],
      ['/datenschutz', 'Datenschutz'],
      ['/agb', 'AGB'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    }
    await page.goto('/gibt-es-nicht');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diese Seite gibt es nicht');
  });
});

test.describe('Bewegung reduzieren', () => {
  test.use({ reducedMotion: 'reduce' });
  test('kein Schnee-Canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test.describe('Mobile Buchungsleiste', () => {
  test('erscheint nach dem Hero und verschwindet bei #buchen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'nur mobil');
    await page.goto('/');
    const bar = page.getByRole('link', { name: 'Lounge buchen · 178,50 €' });
    await expect(bar).toHaveCount(0);
    await page.locator('#anlaesse').scrollIntoViewIfNeeded();
    await expect(bar).toBeVisible();
    await page.evaluate(() =>
      document.getElementById('buchen')!.scrollIntoView({ behavior: 'instant' }),
    );
    await expect(bar).toHaveCount(0);
  });
});
