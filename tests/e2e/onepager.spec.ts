import { expect, test, type Page } from '@playwright/test';
import {
  addDays,
  ALL_START_TIMES,
  MOCK_SETTINGS,
  mockSupabase,
  type MockOptions,
} from './support/mockSupabase';

const firstFreeDay = (page: Page) => page.locator('#buchen table button:not([disabled])').first();
const slots = (page: Page) => page.getByRole('group', { name: 'Zeitfenster' }).locator('button');

test.describe('One-Pager', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('wirbt mit „ab 99 €“, Preisstaffel und Freiverzehr, ohne Kaminfeuer-Versprechen', async ({
    page,
  }) => {
    await page.goto('/');
    const preis = page.locator('#preis');
    await expect(preis).toContainText('Deine Lounge ab 99 €');
    await expect(preis).toContainText('inkl. 3,50 € Vorverkaufsgebühr');
    for (const p of ['99 €', '149 €', '199 €']) await expect(preis).toContainText(p);
    await expect(preis).toContainText('inkl. 100 € Freiverzehr');
    await expect(preis).not.toContainText('175');
    await expect(page.locator('#start')).toContainText('Freiverzehr');
    await expect(page.locator('body')).not.toContainText('Kaminfeuer');
  });

  test('mobil: Logo im Header zentriert, kein Buchen-Button oben', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'nur mobil');
    await page.goto('/');
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Lounge buchen' }),
    ).toBeHidden();
    const logo = await page
      .getByRole('banner')
      .getByAltText(/Die Händler/)
      .boundingBox();
    const vw = page.viewportSize()!.width;
    expect(Math.abs(logo!.x + logo!.width / 2 - vw / 2)).toBeLessThan(4);
  });

  test('Anker springen zu den richtigen Abschnitten', async ({ page }) => {
    await page.goto('/');
    await page.locator('#start').getByRole('link', { name: 'Lounge buchen' }).click();
    await expect(page).toHaveURL(/#buchen$/);
    await expect(page.locator('#buchen')).toBeInViewport();
    await page.goto('/');
    await page.getByRole('link', { name: 'Was dich erwartet' }).click();
    await expect(page.locator('#erlebnis')).toBeInViewport();
    await page.locator('#preis').getByRole('link', { name: 'Lounge buchen' }).click();
    await expect(page.locator('#buchen')).toBeInViewport();
  });

  test('Buchungs-UI: Tag, Zeitfenster, Formular mit Validierung', async ({ page }) => {
    await page.goto('/#buchen');
    await firstFreeDay(page).click();
    await slots(page).first().click();

    const submit = page.getByRole('button', { name: /Zahlungspflichtig buchen – \d+,\d\d €/ });
    await submit.click();
    await expect(page.getByText('Bitte gib deinen Vornamen an.')).toBeVisible();
    await expect(page.getByText('Bitte bestätige die AGB und die Verbindlichkeit.')).toBeVisible();

    // Rechnungsadresse erscheint erst bei Firma oder Rechnungswunsch
    await expect(page.getByLabel('PLZ')).toHaveCount(0);
    await page.getByLabel('Firmenname (optional)').fill('Muster GmbH');
    await expect(page.getByLabel('PLZ')).toBeVisible();

    await page.getByLabel('Vorname').fill('Anna');
    await page.getByLabel('Nachname').fill('Muster');
    await page.locator('#buchen').getByLabel('E-Mail').fill('anna@example.de');
    await page.getByLabel('Telefon').fill('05231 123456');
    await page.getByLabel('Personenzahl').selectOption('8');
    await expect(page.getByText('Anlass (optional)')).toBeVisible();
    await page.getByLabel('Straße und Hausnummer').fill('Schloßplatz 1');
    await page.getByLabel('PLZ').fill('32756');
    await page.getByLabel('Ort').fill('Detmold');
    await expect(page.getByLabel(/STUDIO\/F-Newsletter/)).not.toBeChecked();
    await page.getByLabel(/Ich akzeptiere die/).check();
    await submit.click();
    await page.waitForURL(/checkout\.stripe\.com/);
  });

  test('Rechtsseiten und 404 erreichbar', async ({ page }) => {
    for (const [path, title] of [
      ['/impressum', 'Impressum'],
      ['/datenschutz', 'Datenschutzerklärung'],
      ['/agb', 'Allgemeine Geschäftsbedingungen'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    }
    await page.goto('/gibt-es-nicht');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diese Seite gibt es nicht');
  });
});

test.describe('Echte Verfügbarkeit (Phase 2)', () => {
  test('Kalender zeigt nur Saisontage; belegt, gesperrt, geschlossen nicht wählbar', async ({
    page,
  }) => {
    const start = MOCK_SETTINGS.season_start;
    const opts: MockOptions = {
      overrides: {
        // Tag 1: alle belegt → ausgebucht
        ...Object.fromEntries(ALL_START_TIMES.map((t) => [`${start} ${t}`, 'taken'])),
        // Tag 2: geschlossen
        ...Object.fromEntries(ALL_START_TIMES.map((t) => [`${addDays(start, 1)} ${t}`, 'closed'])),
      },
    };
    await mockSupabase(page, opts);
    await page.goto('/#buchen');

    const dayBtn = (d: string) =>
      page
        .locator('#buchen table button', { hasText: new RegExp(`^${Number(d.slice(8))}$`) })
        .first();

    // Ein Tag vor Saisonbeginn ist nicht wählbar (sofern im selben Monat).
    const before = addDays(start, -1);
    if (before.slice(0, 7) === start.slice(0, 7)) await expect(dayBtn(before)).toBeDisabled();
    await expect(dayBtn(start)).toBeDisabled();
    await expect(dayBtn(start)).toHaveAccessibleName(/ausgebucht/);
    await expect(dayBtn(addDays(start, 1))).toHaveAccessibleName(/geschlossen/);
  });

  test('Tag mit zwei belegten Zeitfenstern: nur das freie ist wählbar', async ({ page }) => {
    const d = addDays(MOCK_SETTINGS.season_start, 3);
    await mockSupabase(page, {
      overrides: Object.fromEntries(
        ['14:30', '15:30', '16:45', '17:45'].map((t) => [`${d} ${t}`, 'taken']),
      ),
    });
    await page.goto('/#buchen');
    const btn = page
      .locator('#buchen table button', { hasText: new RegExp(`^${Number(d.slice(8))}$`) })
      .first();
    await expect(btn).toHaveAccessibleName(/nur noch 1 Zeitfenster/);
    await btn.click();
    await expect(slots(page).nth(0)).toBeDisabled();
    await expect(slots(page).nth(1)).toBeDisabled();
    await expect(slots(page).nth(2)).toBeEnabled();
  });

  test('Zeitfenster wird während der Auswahl vergeben → Hinweis', async ({ page }) => {
    const opts: MockOptions = { overrides: {} };
    await mockSupabase(page, opts);
    await page.goto('/#buchen');
    await firstFreeDay(page).click();
    const label = (await slots(page).first().innerText()).slice(0, 5);
    const day = MOCK_SETTINGS.season_start;
    opts.overrides![`${day} ${label}`] = 'taken';
    await slots(page).first().click();
    await expect(
      page.getByText('Dieser Termin wurde gerade gebucht. Bitte wähle einen anderen.'),
    ).toBeVisible();
    await expect(page.getByLabel('Vorname')).toHaveCount(0);
  });

  test('Fehler beim Laden: freundliche Meldung mit „Erneut versuchen“', async ({ page }) => {
    const opts: MockOptions = { failAvailability: true };
    await mockSupabase(page, opts);
    await page.goto('/#buchen');
    await expect(
      page.getByText('Die freien Termine können gerade nicht geladen werden.', { exact: false }),
    ).toBeVisible();
    opts.failAvailability = false;
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(firstFreeDay(page)).toBeEnabled();
  });

  test('Tracking: page_view beim Laden, book_click bei „Lounge buchen“', async ({
    page,
    isMobile,
  }) => {
    const tracked: { event_type: string; device: string }[] = [];
    await mockSupabase(page, { tracked });
    await page.goto('/');
    await expect.poll(() => tracked.filter((t) => t.event_type === 'page_view').length).toBe(1);
    await page.locator('#start').getByRole('link', { name: 'Lounge buchen' }).click();
    await expect.poll(() => tracked.filter((t) => t.event_type === 'book_click').length).toBe(1);
    expect(tracked.every((t) => t.device === (isMobile ? 'mobile' : 'desktop'))).toBe(true);
    const cookies = await page.context().cookies();
    expect(cookies).toHaveLength(0);
    const storage = await page.evaluate(() => Object.keys(localStorage).length);
    expect(storage).toBe(0);
  });
});

test.describe('Bewegung reduzieren', () => {
  test.use({ reducedMotion: 'reduce' });
  test('kein Schnee-Canvas', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test.describe('Mobile Buchungsleiste', () => {
  test('erscheint nach dem Hero und verschwindet bei #buchen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'nur mobil');
    await mockSupabase(page);
    await page.goto('/');
    const bar = page.getByRole('link', { name: 'Lounge buchen · ab 99 €' });
    await expect(bar).toHaveCount(0);
    await page.locator('#anlaesse').scrollIntoViewIfNeeded();
    await expect(bar).toBeVisible();
    await page.evaluate(() =>
      document.getElementById('buchen')!.scrollIntoView({ behavior: 'instant' }),
    );
    await expect(bar).toHaveCount(0);
  });
});
