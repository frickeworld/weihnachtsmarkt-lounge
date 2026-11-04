// Versand von Ticket- und Erinnerungsmails. Wird von send-ticket und send-reminders genutzt.
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildIcs, googleCalendarUrl } from './ics.ts';
import {
  contactAttributes,
  addNewsletterContact,
  sendTransactionalEmail,
  upsertBookingContact,
} from './brevo.ts';
import { renderTicketEmail } from './emailTemplates.ts';
import { requireEnv } from './http.ts';
import {
  buildTicketPdf,
  loadTicketSettings,
  ticketCommon,
  TICKET_COLUMNS,
  ticketFileUrl,
  ticketQrPng,
  toBase64,
  type TicketBooking,
} from './ticketDocs.ts';
import { walletAvailability } from './walletConfig.ts';

export type TicketKind = 'ticket' | 'reminder';

async function log(db: SupabaseClient, bookingId: string, type: string, error: unknown | null) {
  await db.from('email_log').insert({
    booking_id: bookingId,
    type,
    status: error ? 'failed' : 'sent',
    error: error ? String((error as Error).message ?? error).slice(0, 1000) : null,
  });
}

/** Abweichender Empfänger (Ticket ist übertragbar): Kopie an eine andere Person. */
export interface TicketRecipient {
  email: string;
  name?: string;
}

/**
 * Erzeugt QR-Code (Storage) und PDF und verschickt die Mail über Brevo.
 * Brevo-Kontakt und Double-Opt-in laufen nur beim ersten Ticket an die Buchungsadresse und dürfen
 * den Versand nie verhindern. Mit `recipient` geht das Ticket an eine andere Adresse; die Buchung
 * bleibt unverändert, Kontakt/Newsletter werden dann nicht angefasst.
 */
export async function deliverTicket(
  db: SupabaseClient,
  bookingId: string,
  kind: TicketKind,
  recipient?: TicketRecipient,
): Promise<{ ok: boolean; error?: string }> {
  const { data: b, error } = await db
    .from('bookings')
    .select(TICKET_COLUMNS)
    .eq('id', bookingId)
    .maybeSingle<TicketBooking>();
  if (error || !b) return { ok: false, error: 'not_found' };
  if (b.status !== 'paid') return { ok: false, error: 'not_paid' };

  const s = await loadTicketSettings(db);
  const siteUrl = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');

  try {
    const qrPng = await ticketQrPng(b.ticket_token);
    const path = `${b.ticket_token}.png`;
    const { error: uploadError } = await db.storage
      .from('tickets')
      .upload(path, qrPng, { contentType: 'image/png', upsert: true });
    if (uploadError) throw uploadError;
    const qrImageUrl = `${supabaseUrl}/storage/v1/object/public/tickets/${path}`;

    const common = ticketCommon(b, s);
    const pdf = await buildTicketPdf(b, s, siteUrl, qrPng);
    const wallet = walletAvailability();
    const mail = renderTicketEmail({
      ...common,
      kind,
      qrImageUrl,
      ticketUrl: `${siteUrl}/ticket/${b.ticket_token}`,
      pdfUrl: ticketFileUrl(supabaseUrl, b.ticket_token, 'pdf'),
      giftUrl: ticketFileUrl(supabaseUrl, b.ticket_token, 'gift'),
      icsUrl: ticketFileUrl(supabaseUrl, b.ticket_token, 'ics'),
      googleCalendarUrl: googleCalendarUrl({
        date: b.date,
        startTime: common.startTime,
        endTime: common.endTime,
        persons: b.persons,
        talerCount: common.talerCount,
        bookingCode: b.booking_code,
        location: s.lounge_location,
        ticketUrl: `${siteUrl}/ticket/${b.ticket_token}`,
      }),
      appleWalletUrl: wallet.apple ? ticketFileUrl(supabaseUrl, b.ticket_token, 'apple') : null,
      googleWalletUrl: wallet.google ? ticketFileUrl(supabaseUrl, b.ticket_token, 'google') : null,
      invoiceUrl: b.stripe_invoice_url,
      siteUrl,
      contactEmail: s.contact_email,
    });

    await sendTransactionalEmail({
      to: recipient
        ? { email: recipient.email, name: recipient.name?.trim() || recipient.email }
        : { email: b.email, name: `${b.first_name} ${b.last_name}` },
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: [
        { name: `Ticket-${b.booking_code}.pdf`, content: toBase64(pdf) },
        // Kalendereintrag nur bei der Buchungsbestätigung, nicht bei der Erinnerung
        ...(kind === 'ticket'
          ? [
              {
                name: `Lounge-${b.booking_code}.ics`,
                content: toBase64(
                  new TextEncoder().encode(
                    buildIcs({
                      uid: `${b.id}@lounge`,
                      date: b.date,
                      startTime: common.startTime,
                      endTime: common.endTime,
                      persons: b.persons,
                      talerCount: common.talerCount,
                      bookingCode: b.booking_code,
                      location: s.lounge_location,
                      ticketUrl: `${siteUrl}/ticket/${b.ticket_token}`,
                    }),
                  ),
                ),
              },
            ]
          : []),
      ],
      tags: [
        kind === 'reminder'
          ? 'lounge-erinnerung'
          : recipient
            ? 'lounge-ticket-weiter'
            : 'lounge-ticket',
      ],
    });
    await log(db, b.id, kind, null);
  } catch (e) {
    console.error(`${kind} ${b.id}`, e);
    await log(db, b.id, kind, e);
    return { ok: false, error: 'send_failed' };
  }

  if (kind === 'ticket' && !recipient) {
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
          // Single-Opt-in: direkt in die Newsletter-Liste (Typ 'doi' bleibt als Protokoll-Name)
          await addNewsletterContact(b.email, attrs);
          await log(db, b.id, 'doi', null);
        } catch (e) {
          console.error('brevo newsletter', e);
          await log(db, b.id, 'doi', e);
        }
      }
    }
  }

  return { ok: true };
}
