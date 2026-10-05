import type { SlotAvailability, SlotStatus } from './availability';
import type { IsoDate } from './dates';
import type { PublicSettings } from './settings';
import { DEMO } from './demo';
import { DEMO_TICKET_TOKEN, demoAvailability, demoSettings, demoSpecialEvents } from './demoApi';
import { env } from './env';
import { restConfigured, rpc } from './rest';

export class ApiUnavailableError extends Error {
  constructor() {
    super('Supabase ist nicht konfiguriert');
  }
}

function ensureConfigured() {
  if (!restConfigured()) throw new ApiUnavailableError();
}

interface SettingsRow {
  price_cents: number;
  fee_cents: number;
  taler_count: number;
  max_persons: number;
  season_start: string;
  season_end: string;
  contact_email: string;
  booking_cutoff_minutes: number;
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  if (DEMO) return demoSettings();
  ensureConfigured();
  const [data, prices] = await Promise.all([
    rpc<SettingsRow>('get_public_settings', {}, 'single').then((d) => d!),
    rpc<PriceRow[]>('get_price_list').catch(() => null),
  ]);
  // Unvollständige Antworten nie übernehmen – dann bleiben die Startwerte stehen.
  const ints = [
    data.price_cents,
    data.fee_cents,
    data.taler_count,
    data.max_persons,
    data.booking_cutoff_minutes,
  ];
  if (!ints.every((n) => Number.isInteger(n)) || !data.season_start || !data.season_end) {
    throw new Error('Ungültige Einstellungen');
  }
  return {
    priceCents: data.price_cents,
    feeCents: data.fee_cents,
    talerCount: data.taler_count,
    maxPersons: data.max_persons,
    seasonStart: data.season_start,
    seasonEnd: data.season_end,
    contactEmail: data.contact_email,
    bookingCutoffMinutes: data.booking_cutoff_minutes,
    priceList: (prices ?? [])
      .filter((p) => Number.isInteger(p.total_cents) && Number.isInteger(p.taler_count))
      .map((p) => ({
        weekday: p.weekday,
        startTime: p.start_time.slice(0, 5),
        endTime: p.end_time.slice(0, 5),
        totalCents: p.total_cents,
        talerCount: p.taler_count,
        label: p.label,
      })),
  };
}

interface PriceRow {
  weekday: number;
  start_time: string;
  end_time: string;
  total_cents: number;
  taler_count: number;
  label: string | null;
}

interface AvailabilityRow {
  slot_date: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  total_cents: number;
  taler_count: number;
  special_title: string | null;
  label: string | null;
}

export async function fetchAvailability(from: IsoDate, to: IsoDate): Promise<SlotAvailability[]> {
  if (DEMO) return demoAvailability(from, to);
  ensureConfigured();
  const data =
    (await rpc<AvailabilityRow[]>('get_availability_priced', { from_date: from, to_date: to })) ??
    [];
  return data.map((r) => ({
    date: r.slot_date,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    status: r.status,
    totalCents: r.total_cents,
    talerCount: r.taler_count,
    specialTitle: r.special_title,
    label: r.label,
  }));
}

export async function trackEvent(
  eventType: 'page_view' | 'book_click',
  device: 'mobile' | 'desktop',
) {
  if (!restConfigured()) return;
  await rpc('track_event', { event_type: eventType, device }).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------
// Edge Functions (Phase 3)
// ---------------------------------------------------------------------------------------

function functionUrl(name: string): string {
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new ApiUnavailableError();
  return `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/${name}`;
}

async function callFunction(
  name: string,
  body: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(functionUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey!,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

export type CheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      kind: 'slot' | 'validation' | 'rate' | 'error';
      message: string;
      fields?: Record<string, string>;
    };

const GENERIC_ERROR =
  'Gerade ist etwas schiefgelaufen. Bitte prüfe deine Verbindung und versuche es noch einmal.';

/** Startet die Zahlung. Preise schickt der Browser nicht mit – die setzt der Server. */
export async function startCheckout(payload: {
  date: IsoDate;
  startTime: string;
  form: unknown;
}): Promise<CheckoutResult> {
  if (DEMO) {
    // Vorschau: statt Stripe direkt die Erfolgsseite zeigen.
    await new Promise((r) => setTimeout(r, 600));
    const f = payload.form as { firstName?: string };
    demoBooking = {
      date: payload.date,
      startTime: payload.startTime,
      firstName: f.firstName ?? 'Gast',
    };
    return { ok: true, url: '/buchung/erfolg?session_id=cs_vorschau' };
  }
  try {
    const { status, data } = await callFunction('create-checkout', payload);
    if (status === 200 && typeof data.url === 'string') return { ok: true, url: data.url };
    const message = typeof data.message === 'string' ? data.message : GENERIC_ERROR;
    if (status === 409 || status === 422) return { ok: false, kind: 'slot', message };
    if (status === 400)
      return {
        ok: false,
        kind: 'validation',
        message,
        fields: (data.fields as Record<string, string>) ?? {},
      };
    if (status === 429) return { ok: false, kind: 'rate', message };
    return { ok: false, kind: 'error', message };
  } catch {
    return { ok: false, kind: 'error', message: GENERIC_ERROR };
  }
}

/** Gibt eine Reservierung frei, wenn der Gast bei Stripe abbricht. */
export async function releaseHold(bookingId: string): Promise<void> {
  if (DEMO) return;
  try {
    await callFunction('release-hold', { bookingId });
  } catch {
    // Ohne Erfolg läuft die Reservierung nach spätestens 30 Minuten automatisch ab.
  }
}

export interface SuccessInfo {
  firstName: string;
  date: IsoDate;
  startTime: string;
  endTime: string;
  bookingCode: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
}

let demoBooking: { date: IsoDate; startTime: string; firstName: string } | null = null;

function demoEnd(start: string): string {
  const [h, m] = start.split(':').map(Number);
  return `${String(h! + 2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export async function fetchSuccessInfo(sessionId: string): Promise<SuccessInfo | null> {
  if (DEMO) {
    const b = demoBooking ?? { date: '2026-12-05', startTime: '17:45', firstName: 'Anna' };
    return {
      firstName: b.firstName,
      date: b.date,
      startTime: b.startTime,
      endTime: demoEnd(b.startTime),
      bookingCode: 'HL-VORS-CHAU',
      status: 'paid',
    };
  }
  ensureConfigured();
  const data = await rpc<{
    first_name: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    booking_code: string;
    status: SuccessInfo['status'];
  }>('get_success_info', { p_session_id: sessionId }, 'maybe');
  if (!data) return null;
  return {
    firstName: data.first_name,
    date: data.slot_date,
    startTime: data.start_time.slice(0, 5),
    endTime: data.end_time.slice(0, 5),
    bookingCode: data.booking_code,
    status: data.status,
  };
}

// ---------------------------------------------------------------------------------------
// Online-Ticket (Phase 4)
// ---------------------------------------------------------------------------------------

export interface TicketInfo {
  firstName: string;
  bookingCode: string;
  date: IsoDate;
  startTime: string;
  endTime: string;
  persons: number;
  status: 'paid' | 'cancelled';
  checkedInAt: string | null;
}

export async function fetchTicket(token: string): Promise<TicketInfo | null> {
  if (DEMO) {
    if (token !== DEMO_TICKET_TOKEN) return null;
    const b = demoBooking ?? { date: '2026-12-05', startTime: '17:45', firstName: 'Anna' };
    return {
      firstName: b.firstName,
      bookingCode: 'HL-VORS-CHAU',
      date: b.date,
      startTime: b.startTime,
      endTime: demoEnd(b.startTime),
      persons: 8,
      status: 'paid',
      checkedInAt: null,
    };
  }
  ensureConfigured();
  const data = await rpc<{
    first_name: string;
    booking_code: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    persons: number;
    status: TicketInfo['status'];
    checked_in_at: string | null;
  }>('get_ticket', { p_token: token }, 'maybe');
  if (!data) return null;
  return {
    firstName: data.first_name,
    bookingCode: data.booking_code,
    date: data.slot_date,
    startTime: data.start_time.slice(0, 5),
    endTime: data.end_time.slice(0, 5),
    persons: data.persons,
    status: data.status,
    checkedInAt: data.checked_in_at,
  };
}

// ---------------------------------------------------------------------------------------
// Ticket-Downloads (Edge Function ticket-files)
// ---------------------------------------------------------------------------------------
export type TicketFileFormat = 'pdf' | 'ics' | 'apple' | 'google';

/** Direkter Link – öffnet PDF, Apple-Pass oder die Google-Wallet-Seite. Der Token ist das Ticket. */
export function ticketFileUrl(token: string, format: TicketFileFormat): string {
  return `${(env.supabaseUrl ?? '').replace(/\/$/, '')}/functions/v1/ticket-files?token=${encodeURIComponent(token)}&format=${format}`;
}

/** Welche Wallets eingerichtet sind (sonst nur PDF). */
export async function fetchWalletInfo(): Promise<{ apple: boolean; google: boolean }> {
  if (DEMO || !env.supabaseUrl) return { apple: false, google: false };
  try {
    const res = await fetch(
      `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/ticket-files?format=info`,
    );
    if (!res.ok) return { apple: false, google: false };
    const j = (await res.json()) as { apple?: boolean; google?: boolean };
    return { apple: j.apple === true, google: j.google === true };
  } catch {
    return { apple: false, google: false };
  }
}

/** Erfolgsseite: Ticket-Token zur Stripe-Session (nur bezahlt). */
export async function fetchSuccessTicketToken(sessionId: string): Promise<string | null> {
  if (DEMO) return DEMO_TICKET_TOKEN;
  const data = await rpc<string>('get_success_ticket_token', { p_session_id: sessionId }).catch(
    () => null,
  );
  return typeof data === 'string' && /^[A-Za-z0-9]{32}$/.test(data) ? data : null;
}

// ---------------------------------------------------------------------------------------
// Kontaktformular (Edge Function contact)
// ---------------------------------------------------------------------------------------
export type ContactResult =
  { ok: true } | { ok: false; message: string; fields?: Record<string, string> };

export async function sendContact(values: Record<string, unknown>): Promise<ContactResult> {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true };
  }
  try {
    const { status, data } = await callFunction('contact', values);
    if (status === 200 && data.ok === true) return { ok: true };
    return {
      ok: false,
      message: typeof data.message === 'string' ? data.message : GENERIC_ERROR,
      fields: data.fields as Record<string, string> | undefined,
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export type WaitlistResult =
  { ok: true } | { ok: false; freeNow?: boolean; message: string; fields?: Record<string, string> };

/** Warteliste für einen ausgebuchten Tag (Edge Function `waitlist`). */
export async function joinWaitlist(values: {
  date: string;
  email: string;
  consent: boolean;
  website: string;
}): Promise<WaitlistResult> {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true };
  }
  try {
    const { status, data } = await callFunction('waitlist', values);
    if (status === 200 && data.ok === true) return { ok: true };
    return {
      ok: false,
      freeNow: data.freeNow === true,
      message: typeof data.message === 'string' ? data.message : GENERIC_ERROR,
      fields: data.fields as Record<string, string> | undefined,
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export interface SpecialEvent {
  date: IsoDate;
  startTime: string;
  endTime: string;
  title: string;
  act: string | null;
  description: string | null;
  totalCents: number;
  talerCount: number;
  status: 'free' | 'taken';
}

/** Kommende Sonderveranstaltungen (Partys, Live-Auftritte) für „Besondere Abende“. */
export async function fetchSpecialEvents(): Promise<SpecialEvent[]> {
  if (DEMO) return demoSpecialEvents();
  if (!restConfigured()) return [];
  const rows =
    (await rpc<
      {
        date: string;
        start_time: string;
        end_time: string;
        title: string;
        act: string | null;
        description: string | null;
        total_cents: number;
        taler_count: number;
        status: 'free' | 'taken';
      }[]
    >('get_special_events')) ?? [];
  return rows.map((r) => ({
    date: r.date,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    title: r.title,
    act: r.act,
    description: r.description,
    totalCents: r.total_cents,
    talerCount: r.taler_count,
    status: r.status,
  }));
}
