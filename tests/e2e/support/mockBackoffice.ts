import type { Page, Route } from '@playwright/test';
import { addDays, mockSupabase } from './mockSupabase';

/**
 * Simuliert Supabase Auth (Passwort-Login, TOTP) und die Admin-Abfragen.
 * Die echte Prüfung (RLS, aal2, Edge Function) deckt der Integrationstest ab.
 */
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function jwt(aal: 'aal1' | 'aal2') {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: 'u-admin',
    role: 'authenticated',
    aal,
    amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: now }],
    exp: now + 3600,
    session_id: 's1',
  })}.sig`;
}

export interface BackofficeOptions {
  role?: 'studio_admin' | 'haendler';
  /** Schon eingerichteter zweiter Faktor. */
  hasFactor?: boolean;
  /** Antworten der Edge Function `admin` nacheinander (letzte wird wiederholt). */
  adminFn?: { status: number; body: Record<string, unknown> }[];
  adminRequests?: Record<string, unknown>[];
}

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

export function sampleBooking(over: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    booking_code: 'HL-ABCD-EFGH',
    date: today(),
    start_time: '19:00:00',
    end_time: '21:00:00',
    status: 'paid',
    source: 'online',
    payment_method: 'stripe',
    first_name: 'Erika',
    last_name: 'Muster',
    email: 'erika@example.de',
    phone: '0123456',
    persons: 8,
    occasion: 'firmenfeier',
    company_name: 'Muster GmbH',
    vat_id: null,
    invoice_requested: false,
    billing_street: null,
    billing_zip: null,
    billing_city: null,
    notes: 'Glühwein für alle',
    newsletter_opt_in: false,
    price_cents: 17500,
    fee_cents: 350,
    haendler_share_cents: 13750,
    amount_total_cents: 17850,
    include_in_settlement: true,
    stripe_payment_intent_id: 'pi_123',
    stripe_invoice_url: null,
    hold_expires_at: null,
    paid_at: new Date().toISOString(),
    checked_in_at: null,
    taler_handed_out_at: null,
    cancelled_at: null,
    cancel_reason: null,
    reminder_sent_at: null,
    admin_override: false,
    anonymized_at: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

export async function mockBackoffice(page: Page, opts: BackofficeOptions = {}) {
  await mockSupabase(page);
  let factorVerified = Boolean(opts.hasFactor);
  let aal: 'aal1' | 'aal2' = 'aal1';
  const user = () => ({
    id: 'u-admin',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'louis@example.de',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-01T00:00:00Z',
    factors: factorVerified
      ? [
          {
            id: 'f1',
            factor_type: 'totp',
            status: 'verified',
            friendly_name: 'App',
            created_at: '',
            updated_at: '',
          },
        ]
      : [],
  });
  const session = () => ({
    access_token: jwt(aal),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'refresh',
    user: user(),
  });

  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    const { password } = route.request().postDataJSON() as { password: string };
    if (password !== 'richtig-123')
      return route.fulfill({
        status: 400,
        json: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      });
    aal = 'aal1';
    return route.fulfill({ json: session() });
  });
  await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user() }));
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/auth/v1/factors', (route) =>
    route.fulfill({
      json: {
        id: 'f1',
        type: 'totp',
        friendly_name: 'App',
        totp: {
          qr_code:
            'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
          secret: 'JBSWY3DPEHPK3PXP',
          uri: 'otpauth://totp/x',
        },
      },
    }),
  );
  await page.route('**/auth/v1/factors/f1/challenge', (route) =>
    route.fulfill({
      json: { id: 'c1', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 },
    }),
  );
  await page.route('**/auth/v1/factors/f1/verify', async (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    if (code !== '123456')
      return route.fulfill({
        status: 422,
        json: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' },
      });
    factorVerified = true;
    aal = 'aal2';
    return route.fulfill({ json: session() });
  });

  await page.route('**/rest/v1/user_roles*', (route) =>
    route.fulfill({ json: [{ role: opts.role ?? 'studio_admin' }] }),
  );

  const one = (route: Route, obj: unknown) => {
    const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill({ json: single ? obj : [obj] });
  };
  await page.route('**/rest/v1/settings*', (route) =>
    one(route, {
      season_start: addDays(today(), -3),
      season_end: addDays(today(), 30),
      price_cents: 17500,
      fee_cents: 350,
      taler_count: 100,
      taler_cents: 10000,
      haendler_share_cents: 13750,
      max_persons: 10,
      booking_cutoff_minutes: 60,
      hold_minutes: 30,
      checkin_early_minutes: 30,
      contact_email: 'info@studio-f.club',
      lounge_location: 'Schlosspark',
      updated_at: new Date().toISOString(),
    }),
  );
  await page.route('**/rest/v1/bookings*', (route) => route.fulfill({ json: [sampleBooking()] }));
  await page.route('**/rest/v1/email_log*', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          type: 'ticket',
          status: 'sent',
          error: null,
          created_at: new Date().toISOString(),
        },
      ],
    }),
  );
  await page.route('**/rest/v1/rpc/admin_dashboard*', (route) => {
    const { p_from, p_to } = route.request().postDataJSON() as { p_from: string; p_to: string };
    const daily = [];
    for (let d = p_from; d <= p_to; d = addDays(d, 1))
      daily.push({ date: d, page_views: 40, book_clicks: 4, bookings: 1 });
    return route.fulfill({
      json: {
        page_views: 1200,
        book_clicks: 120,
        paid_bookings: 12,
        online_paid_in_period: 10,
        available_slots: 66,
        revenue_cents: 12 * 17850,
        haendler_cents: 12 * 13750,
        studio_cents: 12 * 4100,
        checked_in: 5,
        no_shows: 1,
        taler_handed_out: 5,
        pending: 1,
        cancelled: 0,
        daily,
      },
    });
  });
  await page.route('**/rest/v1/rpc/haendler_dashboard*', (route) =>
    route.fulfill({
      json: {
        page_views: 800,
        book_clicks: 80,
        paid_bookings: 2,
        online_paid_in_period: 2,
        available_slots: 66,
        haendler_cents: 27500,
        checked_in: 1,
        no_shows: 1,
        taler_handed_out: 1,
        cancelled: 1,
        daily: [
          { date: addDays(today(), -1), page_views: 30, book_clicks: 3, bookings: 1 },
          { date: today(), page_views: 50, book_clicks: 5, bookings: 1 },
        ],
      },
    }),
  );
  const hb = (over: Record<string, unknown>) => ({
    id: 'h1',
    booking_code: 'HL-AAAA-AAAA',
    slot_date: addDays(today(), -1),
    start_time: '17:00:00',
    end_time: '19:00:00',
    first_name: 'Erika',
    last_name: 'Erschienen',
    company_name: 'Müller GmbH',
    persons: 6,
    occasion: 'firmenfeier',
    status: 'paid',
    checked_in_at: new Date().toISOString(),
    taler_handed_out_at: new Date().toISOString(),
    no_show: false,
    include_in_settlement: true,
    haendler_share_cents: 13750,
    ...over,
  });
  await page.route('**/rest/v1/rpc/haendler_bookings*', (route) =>
    route.fulfill({
      json: [
        hb({}),
        hb({
          id: 'h2',
          booking_code: 'HL-BBBB-BBBB',
          first_name: 'Nico',
          last_name: 'Nichtda',
          company_name: null,
          start_time: '19:00:00',
          end_time: '21:00:00',
          checked_in_at: null,
          taler_handed_out_at: null,
          no_show: true,
        }),
        hb({
          id: 'h3',
          booking_code: 'HL-CCCC-CCCC',
          first_name: 'Stefan',
          last_name: 'Storno',
          company_name: null,
          status: 'cancelled',
          checked_in_at: null,
          taler_handed_out_at: null,
        }),
      ],
    }),
  );
  await page.route('**/rest/v1/rpc/settlement*', (route) => {
    const admin = (opts.role ?? 'studio_admin') === 'studio_admin';
    const row = (code: string, name: string, checked: boolean) => ({
      date: addDays(today(), -1),
      start_time: '17:00',
      end_time: '19:00',
      booking_code: code,
      name,
      company_name: null,
      persons: 6,
      source: 'online',
      checked_in: checked,
      haendler_share_cents: 13750,
      amount_total_cents: admin ? 17850 : null,
    });
    return route.fulfill({
      json: {
        from: addDays(today(), -3),
        to: addDays(today(), 30),
        count: 2,
        haendler_cents: 27500,
        revenue_cents: admin ? 35700 : null,
        studio_cents: admin ? 8200 : null,
        no_shows: 1,
        excluded_cancelled: 1,
        excluded_not_in_settlement: 0,
        rows: [
          row('HL-AAAA-AAAA', 'Erika Erschienen', true),
          row('HL-BBBB-BBBB', 'Nico Nichtda', false),
        ],
      },
    });
  });
  await page.route('**/rest/v1/rpc/admin_check_in*', (route) =>
    route.fulfill({ json: new Date().toISOString() }),
  );
  let adminCalls = 0;
  await page.route('**/functions/v1/admin', async (route) => {
    opts.adminRequests?.push(route.request().postDataJSON());
    const list = opts.adminFn ?? [{ status: 200, body: { ok: true } }];
    const r = list[Math.min(adminCalls++, list.length - 1)]!;
    await route.fulfill({ status: r.status, json: r.body });
  });
}

export async function login(page: Page, password = 'richtig-123') {
  await page.getByLabel('E-Mail').fill('louis@example.de');
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
}
