import { expect, test } from '@playwright/test';
import { login, mockBackoffice } from './support/mockBackoffice';

test.describe('Backoffice: Anmeldung und 2FA', () => {
  test('ohne Anmeldung geht es zum Login, falsches Passwort wird gemeldet', async ({ page }) => {
    await mockBackoffice(page);
    await page.goto('/admin/buchungen');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fbuchungen/);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await login(page, 'falsch');
    await expect(page.getByRole('alert')).toHaveText('E-Mail-Adresse oder Passwort stimmen nicht.');
  });

  test('Admin richtet 2FA ein und landet auf der gewünschten Seite', async ({ page }) => {
    await mockBackoffice(page);
    await page.goto('/admin/buchungen');
    await login(page);
    await expect(
      page.getByRole('heading', { name: 'Zwei-Faktor-Anmeldung einrichten' }),
    ).toBeVisible();
    await page.getByText('Schlüssel zum Abtippen anzeigen').click();
    await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
    await page.getByLabel('6-stelliger Code').fill('000000');
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('alert')).toContainText('Der Code stimmt nicht');
    await page.getByLabel('6-stelliger Code').fill('123456');
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page).toHaveURL(/\/admin\/buchungen$/);
    await expect(page.getByRole('heading', { name: 'Buchungen' })).toBeVisible();
  });

  test('mit eingerichteter 2FA wird nur der Code abgefragt', async ({ page }) => {
    await mockBackoffice(page, { hasFactor: true });
    await page.goto('/login');
    await login(page);
    await expect(page.getByRole('heading', { name: 'Bestätigungscode' })).toBeVisible();
    await page.getByLabel('6-stelliger Code').fill('123 456');
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('Händler kommt nicht in den Admin', async ({ page }) => {
    await mockBackoffice(page, { role: 'haendler' });
    await page.goto('/login');
    await login(page);
    await expect(page).toHaveURL(/\/haendler$/);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Kein Zugang' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Zu meinem Bereich' })).toHaveAttribute(
      'href',
      '/haendler',
    );
  });
});

test.describe('Admin', () => {
  async function enter(page: import('@playwright/test').Page, path = '/admin') {
    await page.goto(`/login?next=${encodeURIComponent(path)}`);
    await login(page);
    await page.getByLabel('6-stelliger Code').fill('123456');
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
  }

  test('Übersicht zeigt Kennzahlen, heutige Lounge und Diagramm mit Tabelle', async ({ page }) => {
    await mockBackoffice(page, { hasFactor: true });
    await enter(page);
    await expect(page.getByText('Erika Muster · 8 Pers.')).toBeVisible();
    await expect(page.getByText('2.142,00 €')).toBeVisible(); // 12 × 178,50 €
    await expect(page.getByText('8,3 %')).toBeVisible(); // 10 ÷ 120
    await expect(
      page.getByLabel('Freitag 20:00 Uhr: 4 von 4 gebucht (100 %) · 796,00 €'),
    ).toBeVisible();
    await page.getByText('Als Tabelle anzeigen').first().click();
    await expect(page.getByRole('table').first()).toBeVisible();
    // Keine waagerechte Scrollleiste
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test('Belegungsplan für eine Woche mit Wünschen', async ({ page }) => {
    await mockBackoffice(page, { hasFactor: true });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(
      new Date(),
    );
    await enter(page, `/admin/belegungsplan/${today}`);
    await expect(
      page.getByRole('heading', { name: 'Lounge der Händler – Belegungsplan' }),
    ).toBeVisible();
    await expect(page.getByText('Erika Muster')).toBeVisible();
    await expect(page.getByText('Glühwein für alle')).toBeVisible();
    await expect(page.getByText('8 Pers.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Woche danach →' })).toBeVisible();
  });

  test('Gewinnspiel: Kennzahlen, Ziehung mit Rückfrage', async ({ page }) => {
    const adminRequests: Record<string, unknown>[] = [];
    await mockBackoffice(page, {
      hasFactor: true,
      adminRequests,
      adminFn: [
        {
          status: 200,
          body: {
            ok: true,
            winner: { firstName: 'Ben', email: 'ben@example.de' },
            participants: 1,
            mailsSent: 1,
          },
        },
      ],
    });
    await enter(page, '/admin/gewinnspiel');
    await expect(page.getByText('Gina Gewinn')).toBeVisible();
    await page.getByRole('button', { name: 'Gewinner ziehen' }).click();
    await expect(page.getByText(/Jetzt ziehen und 1 Mails versenden/)).toBeVisible();
    await page.getByRole('button', { name: 'Ja, jetzt ziehen' }).click();
    await expect(
      page.getByText('Gewonnen hat Ben (ben@example.de). 1 von 1 Mails verschickt.'),
    ).toBeVisible();
    expect(adminRequests).toEqual([{ action: 'giveaway_draw' }]);
  });

  test('Buchung öffnen und einchecken', async ({ page }) => {
    await mockBackoffice(page, { hasFactor: true });
    await enter(page, '/admin/buchungen');
    await page
      .getByRole('button', { name: /Erika Muster/ })
      .filter({ visible: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Buchung HL-ABCD-EFGH' });
    await expect(dialog.getByText('Glühwein für alle')).toBeVisible();
    await expect(dialog.getByText('verschickt')).toBeVisible();
    await dialog.getByRole('button', { name: 'Einchecken' }).click();
    await expect(dialog.getByText('Eingecheckt.')).toBeVisible();
  });

  test('manuelle Buchung: Rückfrage bei Sperre, dann bestätigt', async ({ page }) => {
    const adminRequests: Record<string, unknown>[] = [];
    await mockBackoffice(page, {
      hasFactor: true,
      adminRequests,
      adminFn: [
        {
          status: 409,
          body: {
            ok: false,
            needsOverride: true,
            message: 'Dieses Zeitfenster ist gesperrt. Trotzdem buchen?',
          },
        },
        {
          status: 200,
          body: { ok: true, bookingId: 'b-2', bookingCode: 'HL-NEUE-BUCH', ticketSent: true },
        },
      ],
    });
    await enter(page, '/admin/neue-buchung');
    await page.locator('input[name="slot"]').first().check();
    await page.getByLabel('Vorname').fill('Tele');
    await page.getByLabel('Nachname').fill('Fon');
    await page.getByLabel('E-Mail (für das Ticket)').fill('tele@example.de');
    await page.getByLabel('Telefon').fill('05231 123456');
    await page.getByLabel('Personen').selectOption('6');
    await page.getByText('Überweisung').click();
    await page.getByRole('button', { name: 'Buchung anlegen und Ticket senden' }).click();
    await expect(page.getByText('Dieses Zeitfenster ist gesperrt. Trotzdem buchen?')).toBeVisible();
    await page.getByRole('button', { name: 'Ja, trotzdem buchen' }).click();
    await expect(page.getByText('HL-NEUE-BUCH')).toBeVisible();
    expect(adminRequests).toHaveLength(2);
    expect(adminRequests[0]).toMatchObject({
      action: 'manual_booking',
      override: false,
      paymentMethod: 'ueberweisung',
    });
    expect(adminRequests[1]).toMatchObject({
      override: true,
      form: { firstName: 'Tele', persons: 6 },
    });
    // Preise schickt der Browser nie mit
    expect(JSON.stringify(adminRequests)).not.toMatch(/cents/);
  });

  test('Abmelden führt zurück zum Login', async ({ page }) => {
    await mockBackoffice(page, { hasFactor: true });
    await enter(page);
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
