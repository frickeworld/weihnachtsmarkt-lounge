// Integrationstest Gewinnspiel: Teilnahme mit Freunde-Link, Double-Opt-in, Ziehung im Admin mit
// Mails, Buchung mit Trostpreis-Code (30 % über Stripe) und Gewinn-Code (ohne Zahlung).
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const FN = {
  giveaway: Deno.env.get('FN_GIVEAWAY') ?? 'http://127.0.0.1:8114',
  admin: Deno.env.get('FN_ADMIN') ?? 'http://127.0.0.1:8106',
  checkout: Deno.env.get('FN_CHECKOUT') ?? 'http://127.0.0.1:8101',
};
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** RFC 6238 – wie im Admin-Test. */
async function totp(secretBase32: string, at = Date.now()): Promise<string> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretBase32.replace(/=+$/, '').toUpperCase())
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i++) key[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(at / 30_000)));
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, counter));
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

const nextWeekday = (offset: number, isoDow: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  while (((d.getUTCDay() + 6) % 7) + 1 !== isoDow) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const tuesday = nextWeekday(12, 2);
const friday = nextWeekday(12, 5);

const form = (email: string) => ({
  firstName: 'Gina',
  lastName: 'Gewinn',
  email,
  phone: '05231 123456',
  persons: 6,
  occasion: 'freunde',
  companyName: '',
  invoiceRequested: false,
  vatId: '',
  billingStreet: '',
  billingZip: '',
  billingCity: '',
  notes: '',
  termsAccepted: true,
  newsletterOptIn: false,
});

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

Deno.test({
  name: 'giveaway: Teilnahme, Bestätigung, Ziehung, Codes einlösen',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const mails: { to: { email: string }[]; subject: string; textContent: string }[] = [];
    const contacts: { email: string; listIds: number[] }[] = [];
    const brevo = Deno.serve(
      { hostname: '127.0.0.1', port: 8199, onListen: () => {} },
      async (req) => {
        const body = await req.json();
        if (new URL(req.url).pathname === '/contacts') contacts.push(body);
        else mails.push(body);
        return Response.json({ messageId: 'm1' }, { status: 201 });
      },
    );
    const { data: original } = await db
      .from('settings')
      .select('season_start, season_end, giveaway_active, giveaway_end')
      .eq('id', 1)
      .single();
    const tag = crypto.randomUUID().slice(0, 6);
    const emails = { anna: `anna-${tag}@example.de`, ben: `ben-${tag}@example.de` };
    const confirmUrl = (to: string) =>
      mails.find((m) => m.to[0]!.email === to)!.textContent.match(/token=([A-Za-z0-9]{32})/)![1]!;

    // Admin mit 2FA
    const adminEmail = `gw-admin-${tag}@example.de`;
    const { data: created } = await db.auth.admin.createUser({
      email: adminEmail,
      password: 'Test-Passwort-123!',
      email_confirm: true,
    });
    await db.from('user_roles').insert({ user_id: created.user!.id, role: 'studio_admin' });
    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    const bookingIds: string[] = [];
    try {
      await db.from('checkout_attempts').delete().like('ip_hash', 'giveaway:%');
      await db
        .from('settings')
        .update({
          season_start: new Date().toISOString().slice(0, 10),
          season_end: '2099-12-31',
          giveaway_active: false,
          giveaway_end: null,
        })
        .eq('id', 1);

      await t.step('nicht aktiv → 409', async () => {
        const r = await post(FN.giveaway, { action: 'join' });
        assertEquals(r.status, 409);
      });

      await db.from('settings').update({ giveaway_active: true }).eq('id', 1);

      await t.step('Teilnahme: Pflichtfelder und Einwilligung', async () => {
        const r = await post(FN.giveaway, {
          action: 'join',
          firstName: 'Anna',
          lastName: 'A',
          email: emails.anna,
          company: '',
          consent: false,
          adult: true,
        });
        assertEquals(r.status, 400);
        assert(r.body.fields.consent);
      });

      let annaRef = '';
      await t.step(
        'Anna nimmt teil und bestätigt → Lostopf, Newsletter-Liste, Freunde-Link',
        async () => {
          const r = await post(FN.giveaway, {
            action: 'join',
            firstName: 'Anna',
            lastName: 'A',
            email: emails.anna.toUpperCase(),
            company: 'Muster GmbH',
            consent: true,
            adult: true,
          });
          assertEquals(r.status, 200, JSON.stringify(r.body));
          assertEquals(
            mails.at(-1)!.subject,
            'Bitte bestätige deine Teilnahme am Lounge-Gewinnspiel',
          );
          const c = await post(FN.giveaway, { action: 'confirm', token: confirmUrl(emails.anna) });
          assertEquals(c.status, 200);
          assertMatch(c.body.shareUrl, /\/gewinnspiel\?ref=[A-Z0-9]{8}$/);
          annaRef = c.body.refCode;
          assertEquals(contacts.at(-1)!.email, emails.anna);
          assertEquals(contacts.at(-1)!.listIds, [8]);
        },
      );

      await t.step('Ben über Annas Link → Anna hat 2 Lose', async () => {
        await post(FN.giveaway, {
          action: 'join',
          firstName: 'Ben',
          lastName: 'B',
          email: emails.ben,
          company: '',
          consent: true,
          adult: true,
          ref: annaRef,
        });
        await post(FN.giveaway, { action: 'confirm', token: confirmUrl(emails.ben) });
        const { data } = await db
          .from('giveaway_entries')
          .select('referred_by')
          .eq('email', emails.ben)
          .single();
        assert(data!.referred_by);
      });

      await t.step('Ziehung im Admin: ein Gewinner, alle bekommen eine Mail', async () => {
        await client.auth.signInWithPassword({ email: adminEmail, password: 'Test-Passwort-123!' });
        const { data: f } = await client.auth.mfa.enroll({ factorType: 'totp' });
        await client.auth.mfa.challengeAndVerify({
          factorId: f!.id,
          code: await totp(f!.totp.secret),
        });
        const { data: session } = await client.auth.getSession();
        // Nur unsere beiden Testpersonen im Topf: alle anderen ausschließen
        await db
          .from('giveaway_entries')
          .update({ unsubscribed_at: new Date().toISOString() })
          .not('email', 'in', `(${emails.anna},${emails.ben})`)
          .is('unsubscribed_at', null);
        const before = mails.length;
        const r = await post(
          FN.admin,
          { action: 'giveaway_draw' },
          { Authorization: `Bearer ${session.session!.access_token}`, apikey: ANON_KEY },
        );
        assertEquals(r.status, 200, JSON.stringify(r.body));
        assertEquals(r.body.participants, 2);
        assertEquals(r.body.mailsSent, 2);
        const subjects = mails
          .slice(before)
          .map((m) => m.subject)
          .sort();
        assertEquals(subjects, [
          'Diesmal nicht – aber 30 % für deinen Lounge-Abend',
          'Du hast gewonnen: ein Abend in der Weihnachtsmarkt-Lounge',
        ]);
      });

      const { data: codes } = await db
        .from('discount_codes')
        .select('code, kind, entry_id')
        .in(
          'entry_id',
          (
            (await db.from('giveaway_entries').select('id').in('email', [emails.anna, emails.ben]))
              .data ?? []
          ).map((x) => x.id),
        );
      const winCode = codes!.find((c) => c.kind === 'gewinn')!.code;
      const loserCode = codes!.find((c) => c.kind === 'trostpreis')!.code;

      await t.step('Trostpreis-Code am Freitag → abgelehnt mit Hinweis', async () => {
        const r = await post(FN.checkout, {
          date: friday,
          startTime: '20:00',
          form: form(`gina-${tag}@example.de`),
          discountCode: loserCode,
        });
        assertEquals(r.status, 400);
        assertEquals(r.body.fields.discountCode, 'Dieser Code gilt nur montags bis donnerstags.');
      });

      await t.step('Trostpreis-Code Dienstag 16:45 → Stripe mit 104,30 €', async () => {
        const r = await post(FN.checkout, {
          date: tuesday,
          startTime: '16:45',
          form: form(`gina-${tag}@example.de`),
          discountCode: loserCode.toLowerCase(),
        });
        assertEquals(r.status, 200, JSON.stringify(r.body));
        bookingIds.push(r.body.bookingId);
        const { data: b } = await db
          .from('bookings')
          .select(
            'status, amount_total_cents, discount_cents, taler_cents, haendler_share_cents, discount_code',
          )
          .eq('id', r.body.bookingId)
          .single();
        assertEquals(b, {
          status: 'pending',
          amount_total_cents: 10430,
          discount_cents: 4470,
          taler_cents: 7500,
          haendler_share_cents: 8790,
          discount_code: loserCode,
        });
        const again = await post(FN.checkout, {
          date: tuesday,
          startTime: '19:00',
          form: form(`gina-${tag}@example.de`),
          discountCode: loserCode,
        });
        assertEquals(again.body.fields?.discountCode, 'Dieser Code wurde bereits eingelöst.');
      });

      await t.step(
        'Gewinn-Code Freitag 20:00 → ohne Zahlung bezahlt, Ticket per Mail',
        async () => {
          const before = mails.length;
          const r = await post(FN.checkout, {
            date: friday,
            startTime: '20:00',
            form: form(`gina-${tag}@example.de`),
            discountCode: winCode,
          });
          assertEquals(r.status, 200, JSON.stringify(r.body));
          assertMatch(r.body.url, /\/ticket\/[A-Za-z0-9]{32}\?gewonnen=1$/);
          bookingIds.push(r.body.bookingId);
          const { data: b } = await db
            .from('bookings')
            .select(
              'status, amount_total_cents, taler_cents, haendler_share_cents, payment_method, include_in_settlement',
            )
            .eq('id', r.body.bookingId)
            .single();
          assertEquals(b, {
            status: 'paid',
            amount_total_cents: 0,
            taler_cents: 10000,
            haendler_share_cents: 5000,
            payment_method: 'kostenlos',
            include_in_settlement: true,
          });
          assert(mails.slice(before).some((m) => /Lounge ist gebucht/.test(m.textContent)));
        },
      );

      await t.step('Abmelden: nicht mehr im Lostopf', async () => {
        const { data: e } = await db
          .from('giveaway_entries')
          .select('confirm_token')
          .eq('email', emails.ben)
          .single();
        const r = await post(FN.giveaway, { action: 'unsubscribe', token: e!.confirm_token });
        assertEquals(r.status, 200);
        const { data: after } = await db
          .from('giveaway_entries')
          .select('unsubscribed_at')
          .eq('email', emails.ben)
          .single();
        assert(after!.unsubscribed_at);
      });
    } finally {
      if (bookingIds.length) {
        await db.from('email_log').delete().in('booking_id', bookingIds);
        await db.from('bookings').delete().in('id', bookingIds);
      }
      const { data: entries } = await db
        .from('giveaway_entries')
        .select('id')
        .in('email', [emails.anna, emails.ben]);
      const ids = (entries ?? []).map((e) => e.id);
      if (ids.length) {
        await db.from('discount_codes').delete().in('entry_id', ids);
        await db.from('giveaway_draws').delete().in('winner_entry_id', ids);
        await db
          .from('giveaway_entries')
          .update({ won_draw_id: null, referred_by: null })
          .in('id', ids);
        await db.from('giveaway_entries').delete().in('id', ids);
      }
      await db.from('settings').update(original!).eq('id', 1);
      await db.auth.admin.deleteUser(created.user!.id);
      await brevo.shutdown();
    }
  },
});
