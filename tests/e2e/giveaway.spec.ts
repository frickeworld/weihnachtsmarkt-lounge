import { expect, test } from '@playwright/test';
import { pickDay } from './support/calendar';
import { addDays, MOCK_SETTINGS, mockSupabase, type MockOptions } from './support/mockSupabase';

test.describe('Gewinnspiel', () => {
  test('Band nur bei aktivem Gewinnspiel', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await expect(page.locator('#start h1')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Jede Woche einen Abend/ })).toHaveCount(0);

    await mockSupabase(page, { giveawayActive: true });
    await page.reload();
    await page.getByRole('link', { name: 'Jetzt mitmachen' }).click();
    await expect(page).toHaveURL(/\/gewinnspiel$/);
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
        'LOUNGE-ABC234': { reason: null, percent: 30, discount_cents: 4470, total_cents: 10430 },
      },
    };
    await mockSupabase(page, opts);
    await page.goto('/?code=lounge-abc234#buchen');
    await pickDay(page, tuesday);
    await page.getByRole('group', { name: 'Zeitfenster' }).locator('button').first().click();
    await expect(page.getByText('LOUNGE-ABC234')).toBeVisible();
    await expect(page.getByText('Gewinnspiel-Code −30 %')).toBeVisible();
    await page.getByLabel('Vorname').fill('Anna');
    await page.getByLabel('Nachname').fill('Muster');
    await page.locator('#buchen').getByLabel('E-Mail', { exact: true }).fill('anna@example.de');
    await page.getByLabel('Telefon').fill('05231 123456');
    await page.getByLabel('Personenzahl').selectOption('6');
    await page.getByLabel(/Ich akzeptiere die/).check();
    await page.getByRole('button', { name: /Zahlungspflichtig buchen – 104,30\s€/ }).click();
    await expect.poll(() => opts.checkoutRequests!.length).toBe(1);
    expect(opts.checkoutRequests![0]).toMatchObject({ discountCode: 'LOUNGE-ABC234' });
  });

  test('unbekannter Code: freundliche Meldung', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/#buchen');
    await page.locator('#buchen table button:not([disabled])').first().click();
    await page.getByRole('group', { name: 'Zeitfenster' }).locator('button').first().click();
    await page.getByRole('button', { name: 'Gewinnspiel-Code einlösen' }).click();
    await page.getByLabel('Gewinnspiel-Code').fill('FALSCH-123');
    await page.getByRole('button', { name: 'Einlösen' }).click();
    await expect(
      page.getByText('Diesen Code kennen wir nicht. Bitte prüfe die Schreibweise.'),
    ).toBeVisible();
  });
});
