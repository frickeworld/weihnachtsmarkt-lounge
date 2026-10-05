// Integrationstest für die Geldlogik: echte lokale Datenbank, echte Edge Functions, stripe-mock.
// Start: scripts/functions-integration.sh (startet alles und führt diesen Test aus).
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { createClient } from '@supabase/supabase-js';

const FN = {
  checkout: Deno.env.get('FN_CREATE_CHECKOUT') ?? 'http://127.0.0.1:8101',
  webhook: Deno.env.get('FN_STRIPE_WEBHOOK') ?? 'http://127.0.0.1:8102',
  release: Deno.env.get('FN_RELEASE_HOLD') ?? 'http://127.0.0.1:8103',
  ticket: Deno.env.get('FN_SEND_TICKET') ?? 'http://127.0.0.1:8104',
};
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

// Ein Dienstag in 10–16 Tagen, Saison so gesetzt, dass er drin liegt.
const day = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 10);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const form = {
  firstName: 'Anna',
  lastName: 'Muster',
  email: 'integration@example.de',
  phone: '05231 123456',
  persons: 8,
  occasion: 'firmenfeier',
  companyName: '',
  invoiceRequested: false,
  vatId: '',
  billingStreet: '',
  billingZip: '',
  billingCity: '',
  notes: '',
  termsAccepted: true,
  newsletterOptIn: false,
};

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function signedWebhook(event: unknown, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)),
  );
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
  return post(FN.webhook, payload, { 'Stripe-Signature': `t=${t},v1=${hex}` });
}

const sessionEvent = (
  type: string,
  bookingId: string,
  sessionId: string,
  paymentStatus = 'paid',
) => ({
  id: 'evt_test',
  object: 'event',
  type,
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: sessionId,
      object: 'checkout.session',
      payment_status: paymentStatus,
      metadata: { booking_id: bookingId },
      client_reference_id: bookingId,
      payment_intent: 'pi_integration',
      amount_total: 9900,
      invoice: null,
    },
  },
});

async function booking(id: string) {
  const { data } = await db.from('bookings').select('*').eq('id', id).single();
  return data as Record<string, unknown>;
}

Deno.test({
  name: 'Checkout und Webhook: kompletter Geldfluss',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const { data: original } = await db
      .from('settings')
      .select('season_start, season_end')
      .eq('id', 1)
      .single();
    await db
      .from('settings')
      .update({ season_start: new Date().toISOString().slice(0, 10), season_end: '2099-12-31' })
      .eq('id', 1);
    await db.from('bookings').delete().eq('email', form.email);
    await db.from('checkout_attempts').delete().neq('ip_hash', '');

    let bookingId = '';
    let sessionId = '';

    await t.step('create-checkout legt pending-Buchung mit Server-Preisen an', async () => {
      const r = await post(FN.checkout, { date: day, startTime: '14:30', price_cents: 1, form });
      assertEquals(r.status, 200, JSON.stringify(r.body));
      assertMatch(r.body.url, /^https:\/\/checkout\.stripe\.com\//);
      bookingId = r.body.bookingId;
      const b = await booking(bookingId);
      assertEquals(b.status, 'pending');
      assertEquals(b.price_cents, 9550); // 99 € Nachmittag (Mo–Do) − 3,50 € Gebühr
      assertEquals(b.amount_total_cents, 9900);
      assertEquals(b.haendler_share_cents, 7275); // 50 € + (99 − 3,50 − 50) / 2
      assertEquals(b.taler_cents, 5000);
      assert(b.stripe_checkout_session_id);
      assert(b.terms_accepted_at);
      sessionId = b.stripe_checkout_session_id as string;
    });

    await t.step('Buchung ohne Anlass (optional) wird angenommen', async () => {
      const r = await post(FN.checkout, {
        date: day,
        startTime: '19:00',
        form: { ...form, occasion: null },
      });
      assertEquals(r.status, 200, JSON.stringify(r.body));
      assertEquals((await booking(r.body.bookingId)).occasion, null);
      await post(FN.release, { bookingId: r.body.bookingId });
    });

    await t.step('zweite Buchung desselben Zeitfensters → 409', async () => {
      const r = await post(FN.checkout, { date: day, startTime: '14:30', form });
      assertEquals(r.status, 409);
    });

    await t.step('ungültige Eingaben → 400 mit Feldern', async () => {
      const r = await post(FN.checkout, {
        date: day,
        startTime: '19:00',
        form: { ...form, companyName: 'X GmbH' },
      });
      assertEquals(r.status, 400);
      assert(r.body.fields['form.billingStreet']);
    });

    await t.step('nicht existierendes Zeitfenster → 422', async () => {
      const r = await post(FN.checkout, { date: day, startTime: '18:00', form });
      assertEquals(r.status, 422);
    });

    await t.step('Webhook mit falscher Signatur → 400, Status unverändert', async () => {
      const r = await signedWebhook(
        sessionEvent('checkout.session.completed', bookingId, sessionId),
        'whsec_falsch',
      );
      assertEquals(r.status, 400);
      assertEquals((await booking(bookingId)).status, 'pending');
    });

    await t.step('Webhook checkout.session.completed → paid (idempotent)', async () => {
      assertEquals(
        (await signedWebhook(sessionEvent('checkout.session.completed', bookingId, sessionId)))
          .status,
        200,
      );
      assertEquals(
        (await signedWebhook(sessionEvent('checkout.session.completed', bookingId, sessionId)))
          .status,
        200,
      );
      const b = await booking(bookingId);
      assertEquals(b.status, 'paid');
      assertEquals(b.stripe_payment_intent_id, 'pi_integration');
      assert(b.paid_at);
    });

    await t.step('release-hold auf bezahlte Buchung ändert nichts', async () => {
      const r = await post(FN.release, { bookingId });
      assertEquals(r.body.released, false);
      assertEquals((await booking(bookingId)).status, 'paid');
    });

    await t.step('Abbruch: release-hold gibt pending frei', async () => {
      const r = await post(FN.checkout, { date: day, startTime: '19:00', form });
      assertEquals(r.status, 200, JSON.stringify(r.body));
      const rel = await post(FN.release, { bookingId: r.body.bookingId });
      assertEquals(rel.body.released, true);
      assertEquals((await booking(r.body.bookingId)).status, 'expired');
    });

    await t.step(
      'checkout.session.expired → expired; späte Zahlung bei vergebenem Slot → cancelled',
      async () => {
        const first = await post(FN.checkout, { date: day, startTime: '19:00', form });
        const b1 = await booking(first.body.bookingId);
        await signedWebhook(
          sessionEvent(
            'checkout.session.expired',
            b1.id as string,
            b1.stripe_checkout_session_id as string,
            'unpaid',
          ),
        );
        assertEquals((await booking(b1.id as string)).status, 'expired');

        const second = await post(FN.checkout, { date: day, startTime: '19:00', form });
        assertEquals(second.status, 200);

        await signedWebhook(
          sessionEvent(
            'checkout.session.completed',
            b1.id as string,
            b1.stripe_checkout_session_id as string,
          ),
        );
        const late = await booking(b1.id as string);
        assertEquals(late.status, 'cancelled');
        assertMatch(late.cancel_reason as string, /Erstattung/);
        assertEquals((await booking(second.body.bookingId)).status, 'pending');
      },
    );

    await t.step('send-ticket ist ohne service_role-Schlüssel gesperrt', async () => {
      const r = await post(FN.ticket, { booking_id: bookingId });
      assertEquals(r.status, 401);
    });

    await db.from('bookings').delete().eq('email', form.email);
    await db.from('settings').update(original!).eq('id', 1);
  },
});
