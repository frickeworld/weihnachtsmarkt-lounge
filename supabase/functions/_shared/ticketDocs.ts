// Gemeinsame Bausteine für Ticket-Mail und Downloads (PDF, Apple Wallet, Google Wallet).
import QRCode from 'qrcode';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatLongDate, hhmm } from './format.ts';
import { renderTicketPdf } from './ticketPdf.ts';

export interface TicketBooking {
  id: string;
  status: string;
  ticket_token: string;
  booking_code: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string | null;
  persons: number;
  date: string;
  start_time: string;
  end_time: string;
  newsletter_opt_in: boolean;
  stripe_invoice_url: string | null;
  anonymized_at: string | null;
  /** Freiverzehr dieser Buchung (je nach Zeitfenster 50, 75, 100 € …) */
  taler_cents: number;
}

export const TICKET_COLUMNS =
  'id, status, ticket_token, booking_code, first_name, last_name, email, company_name, persons, date, start_time, end_time, newsletter_opt_in, stripe_invoice_url, anonymized_at, taler_cents';

export interface TicketSettings {
  taler_count: number;
  contact_email: string;
  lounge_location: string;
}

export async function loadTicketSettings(db: SupabaseClient): Promise<TicketSettings> {
  const { data } = await db
    .from('settings')
    .select('taler_count, contact_email, lounge_location')
    .eq('id', 1)
    .single<TicketSettings>();
  return (
    data ?? {
      taler_count: 100,
      contact_email: 'info@studio-f.club',
      lounge_location: 'Weihnachtsmarkt im Schlosspark, Detmold',
    }
  );
}

/** Gemeinsame Anzeigewerte für Mail, PDF und Wallet. */
export function ticketCommon(b: TicketBooking, s: TicketSettings) {
  return {
    firstName: b.first_name,
    dateLabel: formatLongDate(b.date),
    startTime: hhmm(b.start_time),
    endTime: hhmm(b.end_time),
    persons: b.persons,
    bookingCode: b.booking_code,
    // Freiverzehr kommt aus der Buchung (Preisstaffel), nicht aus dem Standard
    talerCount: Math.round(b.taler_cents / 100),
    location: s.lounge_location,
  };
}

/** QR-Code: Inhalt nur der ticket_token, Fehlerkorrektur H, 600 px. */
export function ticketQrPng(token: string): Promise<Uint8Array> {
  return QRCode.toBuffer(token, { errorCorrectionLevel: 'H', width: 600, margin: 2, type: 'png' });
}

/** Bilder kommen von der Website (public/email, public/wallet). Fehlt eins, geht es ohne weiter. */
export async function fetchAsset(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function buildTicketPdf(
  b: TicketBooking,
  s: TicketSettings,
  siteUrl: string,
  qrPng?: Uint8Array,
): Promise<Uint8Array> {
  const site = siteUrl.replace(/\/$/, '');
  const [qr, headerJpg, logoPng] = await Promise.all([
    qrPng ? Promise.resolve(qrPng) : ticketQrPng(b.ticket_token),
    fetchAsset(`${site}/email/kopf.jpg`),
    fetchAsset(`${site}/email/haendler-logo-weiss.png`),
  ]);
  return renderTicketPdf({ ...ticketCommon(b, s), qrPng: qr, headerJpg, logoPng });
}

/** Öffentliche Download-Links (Edge Function ticket-files). */
export function ticketFileUrl(
  supabaseUrl: string,
  token: string,
  format: 'pdf' | 'apple' | 'google',
) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ticket-files?token=${token}&format=${format}`;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
