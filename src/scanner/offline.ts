import { berlinIso } from '../../supabase/functions/_shared/format.ts';
import type { ScanResult, TodayList } from './types';

const TOKEN = /^[A-Za-z0-9]{32}$/;

/** Gleiche Normalisierung wie scanner_scan: 32er-Token oder Buchungscode HL-XXXX-XXXX. */
export function normalizeCode(
  raw: string,
): { kind: 'token'; value: string } | { kind: 'code'; value: string } | null {
  const trimmed = raw.trim();
  if (TOKEN.test(trimmed)) return { kind: 'token', value: trimmed };
  const c = trimmed.toUpperCase().replace(/[\s-]/g, '');
  if (/^HL[A-Z0-9]{8}$/.test(c))
    return { kind: 'code', value: `HL-${c.slice(2, 6)}-${c.slice(6, 10)}` };
  return null;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Prüft einen Code ohne Netz gegen die zwischengespeicherte Liste „Heute“ – nach denselben Regeln
 * wie der Server. Bei Erfolg wird die Liste lokal aktualisiert (Check-in-Zeit).
 * Codes anderer Tage kennt die Liste nicht: Sie gelten offline als „unbekannt“ (Hinweis im UI).
 */
export async function evaluateOffline(
  raw: string,
  today: TodayList,
  now: Date,
  override = false,
): Promise<{ result: ScanResult; today: TodayList }> {
  const code = normalizeCode(raw);
  const hash = code?.kind === 'token' ? await sha256Hex(code.value) : null;
  const booking = code
    ? today.bookings.find((b) => (hash ? b.token_hash === hash : b.booking_code === code.value))
    : undefined;
  if (!booking) return { result: { result: 'invalid', reason: 'unknown', offline: true }, today };
  if (booking.status !== 'paid')
    return {
      result: {
        result: 'invalid',
        reason: booking.status === 'cancelled' ? 'cancelled' : 'unpaid',
        booking,
        offline: true,
      },
      today,
    };
  if (booking.checked_in_at)
    return { result: { result: 'already', booking, offline: true }, today };

  const start =
    Date.parse(berlinIso(booking.date, booking.start_time)) - today.checkin_early_minutes * 60_000;
  const end = Date.parse(berlinIso(booking.date, booking.end_time));
  const t = now.getTime();
  const inWindow = t >= start && t <= end;
  if (!inWindow && !override)
    return { result: { result: 'wrong_slot', booking, offline: true }, today };

  const updated = { ...booking, checked_in_at: now.toISOString() };
  return {
    result: { result: inWindow ? 'ok' : 'override', booking: updated, offline: true },
    today: { ...today, bookings: today.bookings.map((b) => (b.id === booking.id ? updated : b)) },
  };
}

/** Taler offline vormerken. */
export function talerOffline(bookingId: string, today: TodayList, now: Date): TodayList {
  return {
    ...today,
    bookings: today.bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            taler_handed_out_at: b.taler_handed_out_at ?? now.toISOString(),
            checked_in_at: b.checked_in_at ?? now.toISOString(),
          }
        : b,
    ),
  };
}
