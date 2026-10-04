// Versand von Ticket- und Erinnerungsmails. Wird von send-ticket und send-reminders genutzt.
import QRCode from 'qrcode';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  contactAttributes,
  requestNewsletterDoubleOptIn,
  sendTransactionalEmail,
  upsertBookingContact,
} from './brevo.ts';
import { renderTicketEmail } from './emailTemplates.ts';
import { formatLongDate, hhmm } from './format.ts';
import { requireEnv } from './http.ts';
import { renderTicketPdf } from './ticketPdf.ts';

export type TicketKind = 'ticket' | 'reminder';

interface BookingForTicket {
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
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function log(db: SupabaseClient, bookingId: string, type: string, error: unknown | null) {
  await db.from('email_log').insert({
    booking_id: bookingId,
    type,
    status: error ? 'failed' : 'sent',
    error: error ? String((error as Error).message ?? error).slice(0, 1000) : null,
  });
}

/** Bilder für das PDF kommen von der Website (public/email). Fehlt eins, wird ohne gerendert. */
async function fetchAsset(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * Erzeugt QR-Code (Storage) und PDF und verschickt die Mail über Brevo.
 * Brevo-Kontakt und Double-Opt-in laufen nur beim ersten Ticket und dürfen den Versand nie verhindern.
 */
export async function deliverTicket(
  db: SupabaseClient,
  bookingId: string,
  kind: TicketKind,
): Promise<{ ok: boolean; error?: string }> {
  const { data: b, error } = await db
    .from('bookings')
    .select(
      'id, status, ticket_token, booking_code, first_name, last_name, email, company_name, persons, date, start_time, end_time, newsletter_opt_in, stripe_invoice_url',
    )
    .eq('id', bookingId)
    .maybeSingle<BookingForTicket>();
  if (error || !b) return { ok: false, error: 'not_found' };
  if (b.status !== 'paid') return { ok: false, error: 'not_paid' };

  const { data: s } = await db
    .from('settings')
    .select('taler_count, contact_email, lounge_location')
    .eq('id', 1)
    .single<{ taler_count: number; contact_email: string; lounge_location: string }>();

  const siteUrl = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');

  try {
    // QR-Code: Inhalt nur der ticket_token, Fehlerkorrektur H, 600 px.
    const qrPng: Uint8Array = await QRCode.toBuffer(b.ticket_token, {
      errorCorrectionLevel: 'H',
      width: 600,
      margin: 2,
      type: 'png',
    });
    const path = `${b.ticket_token}.png`;
    const { error: uploadError } = await db.storage
      .from('tickets')
      .upload(path, qrPng, { contentType: 'image/png', upsert: true });
    if (uploadError) throw uploadError;
    const qrImageUrl = `${supabaseUrl}/storage/v1/object/public/tickets/${path}`;

    const dateLabel = formatLongDate(b.date);
    const common = {
      firstName: b.first_name,
      dateLabel,
      startTime: hhmm(b.start_time),
      endTime: hhmm(b.end_time),
      persons: b.persons,
      bookingCode: b.booking_code,
      talerCount: s?.taler_count ?? 100,
      location: s?.lounge_location ?? 'Weihnachtsmarkt im Schlosspark Detmold',
    };

    const [headerJpg, logoPng] = await Promise.all([
      fetchAsset(`${siteUrl}/email/kopf.jpg`),
      fetchAsset(`${siteUrl}/email/haendler-logo-weiss.png`),
    ]);
    const pdf = await renderTicketPdf({ ...common, qrPng, headerJpg, logoPng });
    const mail = renderTicketEmail({
      ...common,
      kind,
      qrImageUrl,
      ticketUrl: `${siteUrl}/ticket/${b.ticket_token}`,
      invoiceUrl: b.stripe_invoice_url,
      siteUrl,
      contactEmail: s?.contact_email ?? 'info@studio-f.club',
    });

    await sendTransactionalEmail({
      to: { email: b.email, name: `${b.first_name} ${b.last_name}` },
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: [{ name: `Ticket-${b.booking_code}.pdf`, content: toBase64(pdf) }],
      tags: [kind === 'reminder' ? 'lounge-erinnerung' : 'lounge-ticket'],
    });
    await log(db, b.id, kind, null);
  } catch (e) {
    console.error(`${kind} ${b.id}`, e);
    await log(db, b.id, kind, e);
    return { ok: false, error: 'send_failed' };
  }

  if (kind === 'ticket') {
    const attrs = contactAttributes(b.first_name, b.last_name, b.company_name);
    try {
      await upsertBookingContact(b.email, attrs);
    } catch (e) {
      // Nur protokollieren – das Ticket ist schon raus.
      console.error('brevo contact', e);
      await log(db, b.id, 'contact', e);
    }
    if (b.newsletter_opt_in) {
      const { count } = await db
        .from('email_log')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', b.id)
        .eq('type', 'doi')
        .eq('status', 'sent');
      if (!count) {
        try {
          await requestNewsletterDoubleOptIn(b.email, attrs);
          await log(db, b.id, 'doi', null);
        } catch (e) {
          console.error('brevo doi', e);
          await log(db, b.id, 'doi', e);
        }
      }
    }
  }

  return { ok: true };
}
