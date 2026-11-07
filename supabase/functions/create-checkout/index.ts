// create-checkout: Reserviert ein Zeitfenster (30 Minuten) und startet Stripe Checkout.
// Preise kommen ausschließlich aus der Tabelle settings – nie vom Browser.
import type Stripe from 'stripe';
import {
  createCheckoutRequestSchema,
  DISCOUNT_REASON_TEXT,
  needsBillingAddress,
} from '../_shared/bookingSchema.ts';
import { adminClient, type SettingsRow } from '../_shared/db.ts';
import { formatLongDate, slotLabel } from '../_shared/format.ts';
import { hashClientIp, json, preflight, requireEnv } from '../_shared/http.ts';
import { stripeClient } from '../_shared/stripe.ts';
import { deliverTicket } from '../_shared/ticket.ts';

const SLOT_UNAVAILABLE = 'Dieser Termin ist leider nicht mehr buchbar. Bitte wähle einen anderen.';
const SLOT_TAKEN = 'Dieser Termin wurde gerade gebucht. Bitte wähle einen anderen.';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const db = adminClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'validation', message: 'Ungültige Anfrage.' }, 400);
  }

  const { data: settings, error: settingsError } = await db
    .from('settings')
    .select(
      'price_cents, fee_cents, taler_count, taler_cents, haendler_share_cents, max_persons, hold_minutes, booking_cutoff_minutes, extra_taler_options',
    )
    .eq('id', 1)
    .single<SettingsRow & { extra_taler_options: number[] | null }>();
  if (settingsError || !settings) {
    console.error('settings', settingsError);
    return json(
      {
        error: 'server',
        message: 'Gerade ist ein Fehler aufgetreten. Bitte versuche es gleich noch einmal.',
      },
      500,
    );
  }

  // 1. Validierung (dieselben Regeln wie im Browser)
  const parsed = createCheckoutRequestSchema(settings.max_persons).safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.')] ??= issue.message;
    return json({ error: 'validation', message: 'Bitte prüfe deine Angaben.', fields }, 400);
  }
  const { date, startTime, form, discountCode, extraTaler } = parsed.data;

  // Extra-Taler: nur die im Admin hinterlegten Stufen (1 Taler = 1 €, ohne Gebühr und Rabatt).
  if (extraTaler > 0 && !(settings.extra_taler_options ?? []).includes(extraTaler)) {
    const message = 'Bitte wähle eine der angebotenen Taler-Mengen.';
    return json({ error: 'validation', message, fields: { extraTaler: message } }, 400);
  }
  const extraTalerCents = extraTaler * 100;

  // 2. Zeitfenster prüfen: gleiche Logik wie der Kalender (Saison, Schließtag, Sperre, Buchungsschluss)
  //    get_availability gibt abgelaufene Reservierungen vorher frei.
  const { data: slots, error: availError } = await db.rpc('get_availability', {
    from_date: date,
    to_date: date,
  });
  if (availError) {
    console.error('availability', availError);
    return json(
      {
        error: 'server',
        message: 'Gerade ist ein Fehler aufgetreten. Bitte versuche es gleich noch einmal.',
      },
      500,
    );
  }
  const slot = (slots as { start_time: string; end_time: string; status: string }[]).find(
    (s) => s.start_time.slice(0, 5) === startTime,
  );
  if (!slot) return json({ error: 'slot_unavailable', message: SLOT_UNAVAILABLE }, 422);
  if (slot.status === 'taken') return json({ error: 'slot_taken', message: SLOT_TAKEN }, 409);
  if (slot.status !== 'free')
    return json({ error: 'slot_unavailable', message: SLOT_UNAVAILABLE }, 422);

  // Gewinnspiel- oder Admin-Rabattcode: Preis rechnet ausschließlich die Datenbank.
  type Discounted = {
    source: 'giveaway' | 'promo';
    reason: string | null;
    discount_cents: number;
    total_cents: number;
    fee_cents: number;
    price_cents: number;
    taler_cents: number;
    haendler_share_cents: number;
  };
  let discount: Discounted | null = null;
  if (discountCode) {
    const { data: rows, error: discountError } = await db.rpc('code_pricing', {
      p_code: discountCode,
      p_date: date,
      p_start: slot.start_time,
    });
    const d = (rows as Discounted[] | null)?.[0];
    if (discountError || !d) {
      console.error('discount', discountError);
      return json(
        { error: 'server', message: 'Der Code konnte gerade nicht geprüft werden.' },
        500,
      );
    }
    if (d.reason) {
      const message = DISCOUNT_REASON_TEXT[d.reason] ?? 'Bitte prüfe den Code.';
      return json({ error: 'validation', message, fields: { discountCode: message } }, 400);
    }
    discount = d;
  }
  const amounts = discount
    ? {
        // Gewinnspiel-Codes sind einmalig (eigene Spalte mit Unique-Index), Admin-Codes mehrfach.
        ...(discount.source === 'promo'
          ? { promo_code: discountCode }
          : { discount_code: discountCode }),
        discount_cents: discount.discount_cents,
        amount_total_cents: discount.total_cents,
        fee_cents: discount.fee_cents,
        price_cents: discount.price_cents,
        taler_cents: discount.taler_cents,
        haendler_share_cents: discount.haendler_share_cents,
      }
    : {};

  // Gewinn (100 %) ohne Extra-Taler: keine Zahlung – Buchung direkt bestätigen und Ticket senden.
  // Mit Extra-Taler geht es zu Stripe, bezahlt werden dann nur die Extra-Taler.
  if (discount && discount.total_cents === 0 && extraTalerCents === 0) {
    const { data: won, error: wonError } = await db
      .from('bookings')
      .insert({
        date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: 'paid',
        source: 'online',
        payment_method: 'kostenlos',
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: form.phone,
        persons: form.persons,
        occasion: form.occasion ?? null,
        company_name: form.companyName || null,
        notes: form.notes || null,
        newsletter_opt_in: form.newsletterOptIn,
        terms_accepted_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
        include_in_settlement: true,
        ...amounts,
      })
      .select('id, ticket_token')
      .single<{ id: string; ticket_token: string }>();
    if (wonError || !won) {
      if (wonError?.code === '23505')
        return json({ error: 'slot_taken', message: SLOT_TAKEN }, 409);
      console.error('insert gewinn', wonError);
      return json({ error: 'server', message: 'Gerade ist ein Fehler aufgetreten.' }, 500);
    }
    await deliverTicket(db, won.id, 'ticket');
    const site = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
    return json({ url: `${site}/ticket/${won.ticket_token}?gewonnen=1`, bookingId: won.id });
  }

  // Schutz vor Massen-Reservierungen: Gezählt werden nur echte Reservierungen (nicht jeder Versuch),
  // damit Gäste hinter einer geteilten Mobilfunk-IP nicht ausgesperrt werden.
  const { data: allowed, error: rateError } = await db.rpc('register_checkout_attempt', {
    p_ip_hash: await hashClientIp(req),
    max_attempts: 10,
  });
  if (rateError) console.error('rate', rateError);
  if (allowed === false) {
    return json(
      {
        error: 'rate_limited',
        message: 'Zu viele Reservierungen in kurzer Zeit. Bitte warte ein paar Minuten.',
      },
      429,
    );
  }

  // 3. Buchung als pending anlegen. Beträge setzt die Datenbank aus settings.
  //    Stripe verlangt mindestens 30 Minuten Laufzeit; 2 Minuten Puffer gegen Uhrzeit-Abweichungen.
  const holdMinutes = Math.max(settings.hold_minutes, 30) + 2;
  const holdExpiresAt = new Date(Date.now() + holdMinutes * 60_000);
  const withBilling = needsBillingAddress(form);
  const { data: booking, error: insertError } = await db
    .from('bookings')
    .insert({
      date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: 'pending',
      source: 'online',
      payment_method: 'stripe',
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      persons: form.persons,
      occasion: form.occasion ?? null,
      company_name: form.companyName || null,
      vat_id: withBilling && form.vatId ? form.vatId.replace(/\s/g, '') : null,
      invoice_requested: form.invoiceRequested,
      billing_street: withBilling ? form.billingStreet : null,
      billing_zip: withBilling ? form.billingZip : null,
      billing_city: withBilling ? form.billingCity : null,
      notes: form.notes || null,
      newsletter_opt_in: form.newsletterOptIn,
      terms_accepted_at: new Date().toISOString(),
      hold_expires_at: holdExpiresAt.toISOString(),
      // Der Trigger rechnet die Extra-Taler auf Gesamtbetrag und Händler-Anteil.
      extra_taler_cents: extraTalerCents,
      ...amounts,
    })
    .select(
      'id, booking_code, price_cents, fee_cents, taler_cents, extra_taler_cents, amount_total_cents',
    )
    .single<{
      id: string;
      booking_code: string;
      price_cents: number;
      fee_cents: number;
      taler_cents: number;
      extra_taler_cents: number;
      amount_total_cents: number;
    }>();

  if (insertError || !booking) {
    if (insertError?.code === '23505')
      return json({ error: 'slot_taken', message: SLOT_TAKEN }, 409);
    console.error('insert', insertError);
    return json(
      {
        error: 'server',
        message: 'Gerade ist ein Fehler aufgetreten. Bitte versuche es gleich noch einmal.',
      },
      500,
    );
  }

  // 4. Stripe Checkout Session
  const stripe = stripeClient();
  const siteUrl = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  const when = `${formatLongDate(date)}, ${slotLabel(slot.start_time, slot.end_time)}`;
  const taxLounge = Deno.env.get('STRIPE_TAX_RATE_LOUNGE');
  const taxFee = Deno.env.get('STRIPE_TAX_RATE_FEE');
  // Nur sofort bestätigte Zahlarten: Karte (inkl. Apple Pay / Google Pay) und PayPal.
  // Filter auf die im Stripe-Dashboard aktivierten Zahlarten – SEPA, Klarna & Co. fallen damit weg.
  const paymentMethodTypes = (Deno.env.get('STRIPE_PAYMENT_METHOD_TYPES') ?? 'card,paypal')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];

  // Gewinn-Code mit Extra-Taler: Die Lounge kostet nichts, bezahlt werden nur die Extra-Taler.
  const loungeIsFree = booking.amount_total_cents - booking.extra_taler_cents === 0;
  const extraLine: Stripe.Checkout.SessionCreateParams.LineItem[] =
    booking.extra_taler_cents > 0
      ? [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: booking.extra_taler_cents,
              product_data: {
                name: `Zusätzliche Residenztaler: ${booking.extra_taler_cents / 100} Taler${
                  loungeIsFree ? ` (zu deinem Lounge-Gewinn am ${when})` : ''
                }`,
              },
            },
          },
        ]
      : [];
  const loungeLines: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: booking.price_cents - booking.taler_cents,
        product_data: {
          name: `Weihnachtsmarkt-Lounge am ${when} – bis zu ${settings.max_persons} Personen${
            discount
              ? ` (${discount.source === 'promo' ? 'Rabattcode' : 'Gewinnspiel-Code'} ${discountCode}, −${(discount.discount_cents / 100).toFixed(2).replace('.', ',')} €)`
              : ''
          }`,
        },
      },
      ...(taxLounge ? { tax_rates: [taxLounge] } : {}),
    },
    {
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: booking.taler_cents,
        product_data: { name: `Freiverzehr: ${booking.taler_cents / 100} Residenztaler` },
      },
    },
    {
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: booking.fee_cents,
        product_data: { name: 'Verarbeitungsgebühr' },
      },
      ...(taxFee ? { tax_rates: [taxFee] } : {}),
    },
  ];
  const lineItems = [...(loungeIsFree ? [] : loungeLines), ...extraLine];

  const description = `Weihnachtsmarkt-Lounge am ${when} · Buchungscode ${booking.booking_code}`;

  try {
    let customerParams: Pick<
      Stripe.Checkout.SessionCreateParams,
      'customer' | 'customer_email' | 'customer_creation' | 'invoice_creation'
    >;
    if (withBilling) {
      const customer = await stripe.customers.create({
        name: form.companyName || `${form.firstName} ${form.lastName}`,
        email: form.email,
        phone: form.phone,
        preferred_locales: ['de'],
        address: {
          line1: form.billingStreet,
          postal_code: form.billingZip,
          city: form.billingCity,
          country: 'DE',
        },
        ...(form.vatId
          ? { tax_id_data: [{ type: 'eu_vat', value: form.vatId.replace(/\s/g, '') }] }
          : {}),
        metadata: { booking_id: booking.id },
      });
      customerParams = {
        customer: customer.id,
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description,
            metadata: { booking_id: booking.id },
            custom_fields: [{ name: 'Buchungscode', value: booking.booking_code }],
          },
        },
      };
    } else {
      customerParams = { customer_email: form.email, customer_creation: 'if_required' };
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        locale: 'de',
        allowed_payment_method_types: paymentMethodTypes,
        line_items: lineItems,
        ...customerParams,
        client_reference_id: booking.id,
        metadata: { booking_id: booking.id, booking_code: booking.booking_code },
        payment_intent_data: {
          description,
          metadata: { booking_id: booking.id, booking_code: booking.booking_code },
        },
        expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
        success_url: `${siteUrl}/buchung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/?abbruch=${booking.id}#buchen`,
        custom_text: {
          submit: {
            message:
              'Die Buchung ist verbindlich. Als termingebundene Freizeitleistung besteht kein Widerrufsrecht.',
          },
        },
      },
      { idempotencyKey: `checkout-${booking.id}` },
    );

    const { error: sessionSaveError } = await db
      .from('bookings')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', booking.id);
    // Nicht fatal: Der Webhook findet die Buchung über metadata.booking_id.
    if (sessionSaveError) console.error('session id', sessionSaveError);
    return json({ url: session.url, bookingId: booking.id });
  } catch (e) {
    console.error('stripe', e);
    await db.rpc('mark_booking_expired', { p_booking_id: booking.id });
    const err = e as { type?: string; param?: string; code?: string };
    if (
      err.type === 'StripeInvalidRequestError' &&
      (err.param?.includes('tax_id') || err.code === 'tax_id_invalid')
    ) {
      return json(
        {
          error: 'validation',
          message: 'Bitte prüfe die USt-ID.',
          fields: { 'form.vatId': 'Bitte prüfe die USt-ID (z. B. DE123456789).' },
        },
        400,
      );
    }
    return json(
      {
        error: 'payment_unavailable',
        message:
          'Die Zahlung konnte gerade nicht gestartet werden. Bitte versuche es gleich noch einmal.',
      },
      502,
    );
  }
});
