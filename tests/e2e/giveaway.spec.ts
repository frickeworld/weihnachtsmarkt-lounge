import { expect, test } from '@playwright/test';
import { pickDay } from './support/calendar';
import { addDays, MOCK_SETTINGS, mockSupabase, type MockOptions } from './support/mockSupabase';
import { submitBooking } from './support/booking';

test.describe('Gewinnspiel', () => {
  test('Band nur bei aktivem Gewinnspiel', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await expect(page.locator('#start h1')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Jede Woche eine Lounge/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Lounge gewinnen' })).toHaveCount(0);

    await mockSupabase(page, { giveawayActive: true });
    await page.reload();
    // Laufende Leiste und Geschenk oben, Countdown im Band
    await expect(page.getByRole('link', { name: /^Lounge gewinnen: Ziehung/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lounge gewinnen', exact: true })).toBeVisible();
    await expect(page.getByLabel(/^Noch 3 Tage, 5 Stunden/)).toBeVisible();
    await expect(page.getByText(/Einmal mitmachen, jede Woche dabei/).first()).toBeVisible();
    // Kein Hinweis auf Rabatt für Nicht-Gewinner (Entscheidung Louis, 16.11.2026)
    await expect(page.getByText(/Rabatt/)).toHaveCount(0);
    await page.getByRole('link', { name: 'Jetzt mitmachen' }).click();
    await expect(page).toHaveURL(/\/gewinnspiel$/);
    await expect(page.getByText(/Ein ganzer Abend für bis zu 10 Personen/)).toBeVisible();
    // Keine Teilnehmerzahl und kein Rabatt-Versprechen auf der Gewinnspiel-Seite
    await expect(page.getByText('Im Lostopf', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Nicht gewonnen\?|% auf deinen Lounge-Abend/)).toHaveCount(0);
  });

  test('Teilnahme mit Freunde-Link, Einwilligung Pflicht', async ({ page }) => {
    const opts: MockOptions = { giveawayActive: true, giveawayRequests: [] };
    await mockSupabase(page, opts);
    await page.goto('/gewinnspiel?ref=ben12345');
    const form = page.getByRole('form', { name: 'Am Gewinnspiel teilnehmen' });
    await form.getByLabel('Vorname').fill('Anna');
    await form.getByLabel('Nachname').fill('Muster');
    await form.getByLabel('E-Mail', { exact: true }).fill('anna@example.de');
    await form.getByRole('button', { name: 'Jetzt teilnehmen' }).click();
    await expect(
      form.getByText('Bitte bestätige Teilnahmebedingungen und Newsletter.'),
    ).toBeVisible();
    await expect(form.getByText('Teilnahme ab 18 Jahren.')).toBeVisible();
    expect(opts.giveawayRequests).toHaveLength(0);

    await form.getByLabel(/Ich nehme am Gewinnspiel teil/).check();
    await form.getByLabel('Ich bin mindestens 18 Jahre alt.').check();
    await form.getByRole('button', { name: 'Jetzt teilnehmen' }).click();
    await expect(page.getByRole('heading', { name: 'Fast geschafft!' })).toBeVisible();
    expect(opts.giveawayRequests![0]).toMatchObject({
      action: 'join',
      email: 'anna@example.de',
      consent: true,
      adult: true,
      ref: 'BEN12345',
    });
  });

  test('Bestätigung zeigt Freunde-Link', async ({ page }) => {
    await mockSupabase(page, { giveawayActive: true });
    await page.goto('/gewinnspiel/bestaetigt?token=Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z');
    await expect(page.getByRole('heading', { name: 'Du bist im Lostopf, Anna!' })).toBeVisible();
    await expect(page.getByText('http://127.0.0.1:4173/gewinnspiel?ref=ANNA2345')).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });

  test('Teilnahmebedingungen erreichbar', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/gewinnspiel/teilnahmebedingungen');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Teilnahmebedingungen Gewinnspiel' }),
    ).toBeVisible();
    await expect(
      page.getByText(/Mit der Teilnahme meldest du dich zum Newsletter an/),
    ).toBeVisible();
  });

  test('Code aus der Mail: Rabatt in der Zusammenfassung, Code geht an den Server', async ({
    page,
  }) => {
    let tuesday = addDays(MOCK_SETTINGS.season_start, 0);
    while (new Date(`${tuesday}T00:00:00Z`).getUTCDay() !== 2) tuesday = addDays(tuesday, 1);
    const opts: MockOptions = {
      checkoutRequests: [],
      discounts: {
        // Di 14:30: 103,95 € − 10 % (10,40 €) = 93,55 € → Lounge-Preis 88,60 € zzgl. 4,95 € Gebühr
        'LOUNGE-ABC234': { reason: null, percent: 10, discount_cents: 1040, total_cents: 9355 },
      },
    };
    await mockSupabase(page, opts);
    await page.goto('/?code=lounge-abc234#buchen');
    await pickDay(page, tuesday);
    await page.getByRole('group', { name: 'Zeitfenster' }).locator('button').first().click();
    await expect(page.getByText('LOUNGE-ABC234')).toBeVisible();
    await expect(page.getByText('Code −10 %')).toBeVisible();
    await expect(page.getByLabel('Zusammenfassung')).toContainText(/Lounge-Preis\s*88,60\s€/);
    await page.getByLabel('Vorname').fill('Anna');
    await page.getByLabel('Nachname').fill('Muster');
    await page.locator('#buchen').getByLabel('E-Mail', { exact: true }).fill('anna@example.de');
    await page.getByLabel('Telefon').fill('05231 123456');
    await page
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: '6 Personen' }) })
      .click();
    await expect(page.getByRole('radio', { name: '6 Personen' })).toBeChecked();
    await page.getByLabel(/Ich akzeptiere die/).check();
    await submitBooking(page);
    await expect.poll(() => opts.checkoutRequests!.length).toBe(1);
    expect(opts.checkoutRequests![0]).toMatchObject({ discountCode: 'LOUNGE-ABC234' });
  });

  test('unbekannter Code: freundliche Meldung', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/#buchen');
    await page.locator('#buchen table button:not([disabled])').first().click();
    await page.getByRole('group', { name: 'Zeitfenster' }).locator('button').first().click();
    await page.getByRole('button', { name: 'Rabatt- oder Gewinnspiel-Code einlösen' }).click();
    await page.getByLabel('Rabatt- oder Gewinnspiel-Code').fill('FALSCH-123');
    await page.getByRole('button', { name: 'Einlösen' }).click();
    await expect(
      page.getByText('Diesen Code kennen wir nicht. Bitte prüfe die Schreibweise.'),
    ).toBeVisible();
  });
});

test.describe('Gewinnspiel-Pop-up auf der Startseite', () => {
  test('erscheint nach 5 Sekunden, Eintragen direkt im Pop-up', async ({ page }) => {
    const opts: MockOptions = { giveawayActive: true, giveawayRequests: [] };
    await mockSupabase(page, opts);
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Jetzt Lounge gewinnen' });
    await page.waitForTimeout(3000);
    await expect(dialog).toHaveCount(0);
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByLabel(/^Noch \d+ Tage/)).toBeVisible();
    await expect(dialog.getByText(/Rabatt/)).toHaveCount(0);
    await dialog.getByLabel('Vorname').fill('Paula');
    await dialog.getByLabel('Nachname').fill('Pop');
    await dialog.getByLabel('E-Mail', { exact: true }).fill('paula@example.de');
    await dialog.getByLabel(/Ich nehme am Gewinnspiel teil/).check();
    await dialog.getByLabel('Ich bin mindestens 18 Jahre alt.').check();
    await dialog.getByRole('button', { name: 'Jetzt teilnehmen' }).click();
    await expect(dialog.getByRole('heading', { name: 'Fast geschafft!' })).toBeVisible();
    expect(opts.giveawayRequests![0]).toMatchObject({
      action: 'join',
      email: 'paula@example.de',
      consent: true,
      adult: true,
    });
  });

  test('schließen mit Escape, danach nicht noch einmal in derselben Sitzung', async ({ page }) => {
    await mockSupabase(page, { giveawayActive: true });
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Jetzt Lounge gewinnen' });
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(6500);
    await expect(dialog).toHaveCount(0);
  });

  test('nicht bei Direktlink zur Buchung und nicht ohne laufendes Gewinnspiel', async ({
    page,
  }) => {
    await mockSupabase(page, { giveawayActive: true });
    await page.goto('/#buchen');
    await page.waitForTimeout(6500);
    await expect(page.getByRole('dialog', { name: 'Jetzt Lounge gewinnen' })).toHaveCount(0);

    await mockSupabase(page, { giveawayActive: false });
    await page.goto('/gewinnspiel');
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/');
    await page.waitForTimeout(6500);
    await expect(page.getByRole('dialog', { name: 'Jetzt Lounge gewinnen' })).toHaveCount(0);
  });
});
