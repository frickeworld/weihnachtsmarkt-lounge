import type { Page } from '@playwright/test';

/**
 * Simuliert die öffentlichen Supabase-Funktionen für Klicktests ohne echte Datenbank.
 * Die Logik der echten Funktionen ist in supabase/tests (pgTAP) abgedeckt.
 */
const todayIso = () => new Date().toISOString().slice(0, 10);

// Saison relativ zu heute, damit die Tests auch nach der echten Saison laufen.
export function addDays(d: string, n: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export const MOCK_SETTINGS = {
  price_cents: 17500,
  fee_cents: 350,
  taler_count: 100,
  max_persons: 10,
  season_start: addDays(todayIso(), 7),
  season_end: addDays(todayIso(), 40),
  contact_email: 'info@studio-f.club',
  booking_cutoff_minutes: 60,
};

const tier = (
  weekday: number,
  start: string,
  end: string,
  euros: number,
  taler: number,
  label: string,
) => ({
  weekday,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
  total_cents: euros * 100,
  taler_count: taler,
  label,
});

/** Preisstaffel wie in der Migration slot_pricing (Endpreise inkl. 3,50 € Gebühr). */
export const MOCK_PRICE_LIST = [
  ...[1, 2, 3, 4].flatMap((d) => [
    tier(d, '16:45', '18:45', 149, 75, 'Abend'),
    tier(d, '19:00', '21:00', 149, 75, 'Abend'),
  ]),
  ...[5, 6].flatMap((d) => [
    tier(d, '15:30', '17:30', 149, 75, 'Nachmittag'),
    tier(d, '17:45', '19:45', 199, 100, 'Abend'),
    tier(d, '20:00', '22:00', 199, 100, 'Abend'),
  ]),
  tier(7, '14:30', '16:30', 149, 75, 'Nachmittag'),
  tier(7, '16:45', '18:45', 149, 75, 'Abend'),
  tier(7, '19:00', '21:00', 149, 75, 'Abend'),
];

/** Alle Startzeiten der Staffel (für Status-Überschreibungen ganzer Tage). */
export const ALL_START_TIMES = [...new Set(MOCK_PRICE_LIST.map((t) => t.start_time.slice(0, 5)))];

function isoWeekday(d: string) {
  const w = new Date(`${d}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

export interface MockOptions {
  /** Status-Überschreibungen pro "YYYY-MM-DD HH:MM" (veränderbar während des Tests). */
  overrides?: Record<string, string>;
  /** Sonderpreise pro "YYYY-MM-DD HH:MM". */
  specials?: Record<string, { title: string; total_cents: number; taler_count: number }>;
  /** Simuliert einen Serverfehler bei get_availability. */
  failAvailability?: boolean;
  /** Alle Aufrufe von track_event landen hier. */
  tracked?: { event_type: string; device: string }[];
  /** Antwort von create-checkout (Standard: Weiterleitung auf eine Test-Seite). */
  checkout?: { status: number; body: Record<string, unknown> };
  /** Alle Anfragen an create-checkout. */
  checkoutRequests?: unknown[];
  /** Alle Anfragen an release-hold. */
  releaseRequests?: unknown[];
  /** Antworten von get_success_info nacheinander (letzte wird wiederholt). */
  successInfo?: (Record<string, unknown> | null)[];
  /** Ticket-Token auf der Erfolgsseite (get_success_ticket_token). */
  successToken?: string | null;
  /** Eingerichtete Wallets (ticket-files?format=info). */
  wallet?: { apple: boolean; google: boolean };
  /** Antwort von get_special_events („Besondere Abende“). */
  specialEvents?: Record<string, unknown>[];
  /** Alle Anfragen an die Warteliste. */
  waitlistRequests?: unknown[];
  /** Alle Anfragen an das Kontaktformular. */
  contactRequests?: unknown[];
  /** Antwort von get_ticket (null = nicht gefunden). */
  ticket?: Record<string, unknown> | null;
}

export const FAKE_STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_test_e2e';

export async function mockSupabase(page: Page, opts: MockOptions = {}) {
  // .single() fordert bei PostgREST ein einzelnes Objekt an (Accept: application/vnd.pgrst.object+json).
  await page.route('**/rest/v1/rpc/get_public_settings*', (route) => {
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill({ json: single ? MOCK_SETTINGS : [MOCK_SETTINGS] });
  });
  await page.route('**/rest/v1/rpc/track_event*', async (route) => {
    opts.tracked?.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/functions/v1/create-checkout', async (route) => {
    opts.checkoutRequests?.push(route.request().postDataJSON());
    const r = opts.checkout ?? { status: 200, body: { url: FAKE_STRIPE_URL, bookingId: 'b1' } };
    await route.fulfill({ status: r.status, json: r.body });
  });
  await page.route('**/functions/v1/contact', async (route) => {
    opts.contactRequests?.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/functions/v1/waitlist', async (route) => {
    opts.waitlistRequests?.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/functions/v1/release-hold', async (route) => {
    opts.releaseRequests?.push(route.request().postDataJSON());
    await route.fulfill({ json: { released: true } });
  });
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Stripe Checkout (Test)</h1>' }),
  );
  await page.route('**/rest/v1/rpc/get_ticket*', (route) => {
    const item = opts.ticket ?? null;
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (single && !item)
      return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
    return route.fulfill({ json: single ? item : item ? [item] : [] });
  });
  await page.route('**/rest/v1/rpc/get_success_ticket_token*', (route) =>
    route.fulfill({ json: opts.successToken ?? null }),
  );
  await page.route('**/functions/v1/ticket-files?format=info', (route) =>
    route.fulfill({ json: opts.wallet ?? { apple: false, google: false } }),
  );
  let successCalls = 0;
  await page.route('**/rest/v1/rpc/get_success_info*', (route) => {
    const list = opts.successInfo ?? [null];
    const item = list[Math.min(successCalls++, list.length - 1)] ?? null;
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (single && !item)
      return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
    return route.fulfill({ json: single ? item : item ? [item] : [] });
  });
  await page.route('**/rest/v1/rpc/get_special_events*', (route) =>
    route.fulfill({ json: opts.specialEvents ?? [] }),
  );
  await page.route('**/rest/v1/rpc/get_price_list*', (route) =>
    route.fulfill({ json: MOCK_PRICE_LIST }),
  );
  await page.route('**/rest/v1/rpc/get_availability*', (route) => {
    if (opts.failAvailability) return route.fulfill({ status: 500, json: { message: 'kaputt' } });
    const { from_date, to_date } = route.request().postDataJSON() as {
      from_date: string;
      to_date: string;
    };
    const rows = [];
    for (let d = from_date; d <= to_date; d = addDays(d, 1)) {
      const wd = isoWeekday(d);
      for (const t of MOCK_PRICE_LIST.filter((x) => x.weekday === wd)) {
        const st = t.start_time.slice(0, 5);
        const inSeason = d >= MOCK_SETTINGS.season_start && d <= MOCK_SETTINGS.season_end;
        const status = opts.overrides?.[`${d} ${st}`] ?? (inSeason ? 'free' : 'out_of_season');
        const special = opts.specials?.[`${d} ${st}`];
        rows.push({
          slot_date: d,
          start_time: t.start_time,
          end_time: t.end_time,
          status,
          total_cents: special?.total_cents ?? t.total_cents,
          taler_count: special?.taler_count ?? t.taler_count,
          special_title: special?.title ?? null,
          label: t.label,
        });
      }
    }
    return route.fulfill({ json: rows });
  });
}
