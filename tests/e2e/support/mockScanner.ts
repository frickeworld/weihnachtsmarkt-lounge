import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { QR_TOKEN } from './makeQrVideo';

/** Simuliert die Edge Function `scanner` (die echte Logik prüfen pgTAP und der Integrationstest). */
const todayBerlin = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

export function scannerBooking(over: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    booking_code: 'HL-ABCD-EFGH',
    first_name: 'Anna',
    last_name: 'Muster',
    company_name: 'Muster GmbH',
    persons: 8,
    date: todayBerlin(),
    start_time: '00:00',
    end_time: '23:59',
    status: 'paid',
    checked_in_at: null as string | null,
    taler_handed_out_at: null as string | null,
    token_hash: '',
    ...over,
  };
}

export interface ScannerMock {
  requests: Record<string, unknown>[];
  bookings: ReturnType<typeof scannerBooking>[];
  /** Netz weg: Anfragen schlagen fehl */
  offline: boolean;
  /** QR-Inhalt (ticket_token) → Buchungs-ID */
  tokens?: Record<string, string>;
  /** Ergebnis für den nächsten Scan erzwingen (z. B. wrong_slot) */
  nextResult?: string;
}

export async function mockScanner(page: Page, mock: ScannerMock) {
  await page.route('**/rest/v1/rpc/get_public_settings*', (route) => route.fulfill({ json: [] }));
  await page.route('**/functions/v1/scanner', async (route) => {
    if (mock.offline) return route.abort('internetdisconnected');
    const body = route.request().postDataJSON() as Record<string, unknown>;
    mock.requests.push(body);
    if (body.action === 'auth') {
      if (body.pin !== '482915')
        return route.fulfill({
          status: 401,
          json: { error: 'wrong_pin', message: 'PIN falsch. Noch 4 Versuche.' },
        });
      return route.fulfill({
        json: {
          token: 'scanner.token',
          expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
        },
      });
    }
    if (body.token !== 'scanner.token')
      return route.fulfill({ status: 401, json: { error: 'auth' } });
    if (body.action === 'today')
      return route.fulfill({
        json: { date: todayBerlin(), checkin_early_minutes: 30, bookings: mock.bookings },
      });
    if (body.action === 'scan') {
      const code = String(body.code).toUpperCase().replace(/[\s-]/g, '');
      const b = mock.bookings.find(
        (x) =>
          x.booking_code.replace(/-/g, '') === code || mock.tokens?.[String(body.code)] === x.id,
      );
      if (!b) return route.fulfill({ json: { result: 'invalid', reason: 'unknown' } });
      if (b.checked_in_at) return route.fulfill({ json: { result: 'already', booking: b } });
      if (mock.nextResult === 'wrong_slot' && !body.override)
        return route.fulfill({ json: { result: 'wrong_slot', booking: b } });
      b.checked_in_at = new Date().toISOString();
      return route.fulfill({ json: { result: body.override ? 'override' : 'ok', booking: b } });
    }
    if (body.action === 'taler') {
      const b = mock.bookings.find((x) => x.id === body.bookingId)!;
      b.taler_handed_out_at ??= new Date().toISOString();
      b.checked_in_at ??= b.taler_handed_out_at;
      return route.fulfill({ json: { ok: true, already: false, booking: b } });
    }
    return route.fulfill({ status: 400, json: {} });
  });
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export function newMock(over: Partial<ScannerMock> = {}): ScannerMock {
  return {
    requests: [],
    offline: false,
    bookings: [
      scannerBooking({ token_hash: sha(QR_TOKEN) }),
      scannerBooking({
        id: '22222222-2222-4222-8222-222222222222',
        booking_code: 'HL-STOR-NIER',
        first_name: 'Cara',
        last_name: 'Storno',
        status: 'cancelled',
        start_time: '19:00',
        end_time: '21:00',
      }),
    ],
    tokens: { [QR_TOKEN]: '11111111-1111-4111-8111-111111111111' },
    ...over,
  };
}

export async function enterPin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
}

export async function login(page: Page) {
  await page.goto('/scan');
  await enterPin(page, '482915');
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
}
