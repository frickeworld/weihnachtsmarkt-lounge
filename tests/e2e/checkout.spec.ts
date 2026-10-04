import { expect, test, type Page } from '@playwright/test';
import {
  FAKE_STRIPE_URL,
  MOCK_SETTINGS,
  mockSupabase,
  type MockOptions,
} from './support/mockSupabase';

async function fillAndSubmit(page: Page, extra?: (p: Page) => Promise<void>) {
  await page.goto('/#buchen');
  await page.locator('#buchen table button:not([disabled])').first().click();
  await page.getByRole('group', { name: 'Zeitfenster' }).locator('button').first().click();
  await page.getByLabel('Vorname').fill('Anna');
  await page.getByLabel('Nachname').fill('Muster');
  await page.locator('#buchen').getByLabel('E-Mail').fill('anna@example.de');
  await page.getByLabel('Telefon').fill('05231 123456');
  await page.getByLabel('Personenzahl').selectOption('8');
  if (extra) await extra(page);
  await page.getByLabel(/Ich akzeptiere die/).check();
  await page.getByRole('button', { name: /Zahlungspflichtig buchen – 178,50 €/ }).click();
}

test.describe('Checkout (Phase 3)', () => {
  test('leitet zu Stripe weiter und schickt keine Preise mit', async ({ page }) => {
    const opts: MockOptions = { checkoutRequests: [] };
    await mockSupabase(page, opts);
    await fillAndSubmit(page);
    await page.waitForURL(FAKE_STRIPE_URL);
    const req = opts.checkoutRequests![0] as Record<string, unknown>;
    expect(req).toMatchObject({
      date: MOCK_SETTINGS.season_start,
      form: { firstName: 'Anna', persons: 8 },
    });
    expect(JSON.stringify(req)).not.toMatch(/price|amount|cents/i);
  });

  test('Zeitfenster gerade vergeben (409): Hinweis, Formular weg', async ({ page }) => {
    await mockSupabase(page, {
      checkout: {
        status: 409,
        body: {
          error: 'slot_taken',
          message: 'Dieser Termin wurde gerade gebucht. Bitte wähle einen anderen.',
        },
      },
    });
    await fillAndSubmit(page);
    await expect(
      page.getByText('Dieser Termin wurde gerade gebucht. Bitte wähle einen anderen.'),
    ).toBeVisible();
    await expect(page.getByLabel('Vorname')).toHaveCount(0);
  });

  test('Serverseitige Feldfehler erscheinen am Feld', async ({ page }) => {
    await mockSupabase(page, {
      checkout: {
        status: 400,
        body: {
          error: 'validation',
          message: 'Bitte prüfe deine Angaben.',
          fields: { 'form.vatId': 'Bitte prüfe die USt-ID (z. B. DE123456789).' },
        },
      },
    });
    await fillAndSubmit(page, async (p) => {
      await p.getByLabel('Ich benötige eine Rechnung').check();
      await p.getByLabel('Straße und Hausnummer').fill('Schloßplatz 1');
      await p.getByLabel('PLZ').fill('32756');
      await p.getByLabel('Ort').fill('Detmold');
      await p.getByLabel('USt-ID (optional)').fill('DE999');
    });
    await expect(page.getByText('Bitte prüfe die USt-ID (z. B. DE123456789).')).toBeVisible();
    await expect(page.getByRole('button', { name: /Zahlungspflichtig buchen/ })).toBeEnabled();
  });

  test('Netzwerk- oder Stripe-Fehler: freundliche Meldung, erneut versuchen möglich', async ({
    page,
  }) => {
    await mockSupabase(page, {
      checkout: {
        status: 502,
        body: {
          error: 'payment_unavailable',
          message: 'Die Zahlung konnte gerade nicht gestartet werden.',
        },
      },
    });
    await fillAndSubmit(page);
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Die Zahlung konnte gerade nicht gestartet werden.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Zahlungspflichtig buchen/ })).toBeEnabled();
  });

  test('Rückkehr mit „Zurück“ gibt die Reservierung frei', async ({ page }) => {
    const opts: MockOptions = { releaseRequests: [] };
    await mockSupabase(page, opts);
    const id = '11111111-2222-3333-4444-555555555555';
    await page.goto(`/?abbruch=${id}#buchen`);
    await expect(
      page.getByText('Zahlung abgebrochen. Du kannst es gleich noch einmal versuchen.'),
    ).toBeVisible();
    await expect.poll(() => opts.releaseRequests!.length).toBe(1);
    expect(opts.releaseRequests![0]).toEqual({ bookingId: id });
    await expect(page).toHaveURL(/\/#buchen$/);
  });
});

test.describe('Erfolgsseite', () => {
  const info = {
    first_name: 'Anna',
    slot_date: '2026-12-05',
    start_time: '17:30:00',
    end_time: '19:30:00',
    booking_code: 'HL-ABCD-EFGH',
  };

  test('wartet auf den Webhook und zeigt dann die Bestätigung', async ({ page }) => {
    await mockSupabase(page, {
      successInfo: [
        { ...info, status: 'pending' },
        { ...info, status: 'paid' },
      ],
    });
    await page.goto('/buchung/erfolg?session_id=cs_test_e2e');
    await expect(
      page.getByRole('heading', { name: 'Danke, Anna! Deine Lounge ist gebucht.' }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Samstag, 5. Dezember 2026')).toBeVisible();
    await expect(page.getByText('17:30–19:30 Uhr')).toBeVisible();
    await expect(page.getByText('HL-ABCD-EFGH')).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });

  test('bezahlt: Ticket öffnen und als PDF herunterladen', async ({ page }) => {
    const token = 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z';
    await mockSupabase(page, { successInfo: [{ ...info, status: 'paid' }], successToken: token });
    await page.goto('/buchung/erfolg?session_id=cs_test_e2e');
    await expect(page.getByRole('link', { name: 'Ticket jetzt öffnen' })).toHaveAttribute(
      'href',
      `/ticket/${token}`,
    );
    await expect(page.getByRole('link', { name: 'Ticket als PDF herunterladen' })).toHaveAttribute(
      'href',
      new RegExp(`token=${token}&format=pdf$`),
    );
  });

  test('ohne gültige Session: freundlicher Hinweis', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/buchung/erfolg');
    await expect(page.getByRole('heading', { name: 'Buchung nicht gefunden' })).toBeVisible({
      timeout: 30_000,
    });
  });
});
