import { expect, test, type Page } from '@playwright/test';
import { pickDay } from './support/calendar';
import {
  addDays,
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
  await page.getByRole('radio', { name: '8 Personen' }).check({ force: true });
  if (extra) await extra(page);
  await page.getByLabel(/Ich akzeptiere die/).check();
  await page.getByRole('button', { name: /Zahlungspflichtig buchen – \d+,\d\d €/ }).click();
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

  test('Preis je Zeitfenster und Sonderveranstaltung in der Zusammenfassung', async ({ page }) => {
    // Montag in der Saison: 14:30 99 € (+5 % = 104 €), 16:45 149 € (156 €), 19:00 als Sonderpreis
    let monday = MOCK_SETTINGS.season_start;
    while (new Date(`${monday}T00:00:00Z`).getUTCDay() !== 1) monday = addDays(monday, 1);
    await mockSupabase(page, {
      specials: {
        [`${monday} 19:00`]: { title: 'Party-Abend', total_cents: 24900, taler_count: 125 },
      },
    });
    await page.goto('/#buchen');
    await pickDay(page, monday);
    const slots = page.getByRole('group', { name: 'Zeitfenster' }).locator('button');
    await expect(slots).toHaveCount(3);
    await expect(slots.nth(0)).toContainText('14:30–16:30 Uhr');
    await expect(slots.nth(0)).toContainText('99 €');
    await expect(slots.nth(0)).toContainText('50 € Freiverzehr');
    await expect(slots.nth(1)).toContainText('16:45–18:45 Uhr');
    await expect(slots.nth(1)).toContainText('149 €');
    await expect(slots.nth(1)).toContainText('75 € Freiverzehr');
    await expect(slots.nth(2)).toContainText('Party-Abend');
    await slots.nth(2).click();
    await expect(page.locator('#buchen')).toContainText('Sonderveranstaltung');
    await expect(
      page.getByRole('button', { name: /Zahlungspflichtig buchen – 249,00\s€/ }),
    ).toBeVisible();
    await slots.nth(1).click();
    await expect(
      page.getByRole('button', { name: /Zahlungspflichtig buchen – 156,00\s€/ }),
    ).toBeVisible();
    // Zusammenfassung: 156 € = Lounge 149 € + 7 € Vorverkaufsgebühr (5 %)
    const summary = page.locator('#buchen dl').filter({ hasText: 'Vorverkaufsgebühr' });
    await expect(summary).toContainText(/Lounge inkl\. 75 € Freiverzehr\s*149,00\s€/);
    await expect(summary).toContainText(/Vorverkaufsgebühr\s*7,00\s€/);
    await slots.nth(0).click();
    await expect(
      page.getByRole('button', { name: /Zahlungspflichtig buchen – 104,00\s€/ }),
    ).toBeVisible();
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

test.describe('Besondere Termine', () => {
  test('ohne Sonderveranstaltungen kein Abschnitt', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await expect(page.locator('#preis')).toBeVisible();
    await expect(page.locator('#besondere-abende')).toHaveCount(0);
  });

  test('Party buchen und ausgebuchten Live-Abend auf die Warteliste', async ({ page }) => {
    let monday = addDays(MOCK_SETTINGS.season_start, 7);
    while (new Date(`${monday}T00:00:00Z`).getUTCDay() !== 1) monday = addDays(monday, 1);
    const tuesday = addDays(monday, 1);
    const event = (date: string, status: string, title: string) => ({
      date,
      start_time: '19:00:00',
      end_time: '21:00:00',
      title,
      act: title === 'Live-Abend' ? 'Live: Weidmüller' : null,
      description: 'Ein besonderer Abend.',
      total_cents: 24900,
      taler_count: 125,
      status,
    });
    await mockSupabase(page, {
      specials: {
        [`${monday} 19:00`]: { title: 'Party-Abend', total_cents: 24900, taler_count: 125 },
        [`${tuesday} 19:00`]: { title: 'Live-Abend', total_cents: 24900, taler_count: 125 },
      },
      overrides: Object.fromEntries(
        ['14:30', '16:45', '19:00'].map((t) => [`${tuesday} ${t}`, 'taken']),
      ),
      specialEvents: [event(monday, 'free', 'Party-Abend'), event(tuesday, 'taken', 'Live-Abend')],
    });
    await page.goto('/');
    const section = page.locator('#besondere-abende');
    await expect(
      section.getByRole('heading', { name: 'Partys und besondere Abende' }),
    ).toBeVisible();
    await page.locator('#start').getByRole('link', { name: 'Party-Abende ansehen' }).click();
    await expect(section).toBeInViewport();
    await expect(section).toContainText('Live: Weidmüller');
    // Beworben wird der Lounge-Preis ohne Gebühr: 249 € = 237 € + 12 € (5 %)
    await expect(section).toContainText('237 €');
    await expect(section).toContainText('inkl. 125 € Freiverzehr, zzgl. 5 % Vorverkaufsgebühr');

    await section.getByRole('link', { name: /19:00 Uhr buchen$/ }).click();
    await expect(
      page.getByRole('button', { name: /Zahlungspflichtig buchen – 249,00\s€/ }),
    ).toBeVisible();

    await section.getByRole('link', { name: /ausgebucht – auf die Warteliste$/ }).click();
    await expect(page.getByLabel('Wunschtag')).toHaveValue(tuesday);
  });
});

test('Saison ab Montag, 30.11.: Kalender startet im Dezember und zeigt den 30.11.', async ({
  page,
}) => {
  test.skip(new Date() > new Date('2026-11-29T12:00:00Z'), 'nur vor Saisonstart sinnvoll');
  await mockSupabase(page, { season: { start: '2026-11-30', end: '2026-12-30' } });
  await page.goto('/#buchen');
  await expect(page.locator('#buchen h3[aria-live]')).toHaveText('Dezember 2026');
  await expect(
    page.getByRole('button', { name: 'Vorheriger Monat', includeHidden: true }),
  ).toBeDisabled();
  const first = page.getByRole('button', { name: /^Montag, 30\. November 2026, frei/ });
  await expect(first).toBeVisible();
  // 31.12. außerhalb der Saison: ausgegraut; Januar-Tage der letzten Zeile werden nicht gezeigt
  await expect(
    page.getByRole('button', { name: /^Donnerstag, 31\. Dezember 2026/ }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: /Januar 2027/ })).toHaveCount(0);
  await first.click();
  const slots = page.getByRole('group', { name: 'Zeitfenster' }).locator('button');
  await expect(slots.first()).toContainText('14:30–16:30 Uhr');
});
