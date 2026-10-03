// stripe-webhook: Einziger Weg, auf dem eine Online-Buchung „bezahlt“ wird.
// Ohne JWT erreichbar, dafür wird jede Anfrage über die Stripe-Signatur geprüft.
import type Stripe from 'stripe';
import { adminClient } from '../_shared/db.ts';
import { json, requireEnv } from '../_shared/http.ts';
import { cryptoProvider, stripeClient } from '../_shared/stripe.ts';

async function triggerTicket(bookingId: string) {
  try {
    const res = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/send-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    if (!res.ok) console.error('send-ticket', res.status, await res.text());
  } catch (e) {
    // Der Ticketversand darf die Zahlungsbestätigung nie blockieren.
    console.error('send-ticket', e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();
  const stripe = stripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature ?? '',
      requireEnv('STRIPE_WEBHOOK_SECRET'),
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    console.warn('Ungültige Signatur', (e as Error).message);
    return json({ error: 'invalid_signature' }, 400);
  }

  const db = adminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') break;
        const bookingId = session.metadata?.booking_id ?? session.client_reference_id;
        if (!bookingId) break;

        const paymentIntent =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);
        const { data: result, error } = await db.rpc('mark_booking_paid', {
          p_booking_id: bookingId,
          p_session_id: session.id,
          p_payment_intent: paymentIntent,
          p_amount_total: session.amount_total,
        });
        if (error) throw error;

        if (result === 'conflict') {
          console.error(
            `Buchung ${bookingId}: bezahlt, aber Zeitfenster vergeben – Erstattung nötig`,
          );
        }

        // Rechnungslink speichern, falls Stripe schon eine Rechnung erzeugt hat.
        const invoiceId =
          typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
        if (invoiceId) {
          try {
            const invoice = await stripe.invoices.retrieve(invoiceId);
            if (invoice.hosted_invoice_url) {
              await db.rpc('set_booking_invoice_url', {
                p_booking_id: bookingId,
                p_url: invoice.hosted_invoice_url,
              });
            }
          } catch (e) {
            console.warn('invoice', e);
          }
        }

        if (result === 'paid') await triggerTicket(bookingId);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id ?? session.client_reference_id;
        if (bookingId) {
          const { error } = await db.rpc('mark_booking_expired', { p_booking_id: bookingId });
          if (error) throw error;
        }
        break;
      }

      case 'invoice.finalized':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const bookingId = invoice.metadata?.booking_id;
        if (bookingId && invoice.hosted_invoice_url) {
          const { error } = await db.rpc('set_booking_invoice_url', {
            p_booking_id: bookingId,
            p_url: invoice.hosted_invoice_url,
          });
          if (error) throw error;
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    // 500 → Stripe wiederholt die Zustellung automatisch.
    console.error('webhook', event.type, e);
    return json({ error: 'processing_failed' }, 500);
  }

  return json({ received: true });
});
