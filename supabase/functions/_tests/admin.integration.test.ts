// Integrationstest Admin-Function: echter Login, TOTP-2FA, manuelle Buchung, Override, Rollen.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const FN_ADMIN = Deno.env.get('FN_ADMIN') ?? 'http://127.0.0.1:8106';
const MAILPIT = Deno.env.get('MAILPIT_URL');
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** RFC 6238 – 6 Ziffern, 30 s, SHA-1 (wie Authenticator-Apps). */
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

Deno.test({
  name: 'admin: 2FA-Pflicht, manuelle Buchung mit Ticket, Override, Rollen',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const brevo = Deno.serve({ hostname: '127.0.0.1', port: 8199, onListen: () => {} }, () =>
      Response.json({ messageId: 'm1' }, { status: 201 }),
    );

    const email = `admin-${crypto.randomUUID().slice(0, 8)}@example.de`;
    const password = 'Test-Passwort-123!';
    const { data: created } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    const userId = created.user!.id;
    await db.from('user_roles').insert({ user_id: userId, role: 'studio_admin' });

    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    await client.auth.signInWithPassword({ email, password });

    const call = async (body: unknown) => {
      const { data } = await client.auth.getSession();
      const res = await fetch(FN_ADMIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session!.access_token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };

    const form = {
      firstName: 'Tele',
      lastName: 'Fon',
      email: 'telefon-buchung@example.de',
      phone: '0123456',
      persons: 6,
      companyName: '',
      vatId: '',
      billingStreet: '',
      billingZip: '',
      billingCity: '',
      notes: '',
      invoiceRequested: false,
      newsletterOptIn: false,
    };
    const ids: string[] = [];

    try {
      await t.step('ohne Anmeldung → 401, ohne 2FA → 403', async () => {
        const anon = await fetch(FN_ADMIN, { method: 'POST', body: '{}' });
        assertEquals(anon.status, 401);
        await anon.body?.cancel();
        const r = await call({ action: 'manual_booking' });
        assertEquals(r.status, 403);
      });

      await t.step('TOTP einrichten und bestätigen → aal2', async () => {
        const { data: enrolled, error } = await client.auth.mfa.enroll({ factorType: 'totp' });
        assert(!error, error?.message);
        const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
          factorId: enrolled!.id,
          code: await totp(enrolled!.totp.secret),
        });
        assert(!verifyError, verifyError?.message);
        const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        assertEquals(aal!.currentLevel, 'aal2');
      });

      await t.step('manuelle Buchung (bar) → bezahlt, Ticket verschickt', async () => {
        const r = await call({
          action: 'manual_booking',
          date: '2026-12-08',
          startTime: '16:45',
          paymentMethod: 'bar',
          includeInSettlement: true,
          form,
        });
        assertEquals(r.status, 200, JSON.stringify(r.body));
        assertEquals(r.body.ticketSent, true);
        ids.push(r.body.bookingId);
        const { data: b } = await db
          .from('bookings')
          .select('status, source, payment_method, amount_total_cents, created_by')
          .eq('id', r.body.bookingId)
          .single();
        assertEquals(b!.status, 'paid');
        assertEquals(b!.source, 'manual');
        assertEquals(b!.payment_method, 'bar');
        assertEquals(b!.amount_total_cents, 14900); // Dienstag 16:45: 149 €
        assertEquals(b!.created_by, userId);
        const { data: log } = await db
          .from('email_log')
          .select('type, status')
          .eq('booking_id', r.body.bookingId)
          .eq('type', 'ticket');
        assertEquals(log, [{ type: 'ticket', status: 'sent' }]);
      });

      await t.step('gleiches Zeitfenster → 409, auch mit Override', async () => {
        const r = await call({
          action: 'manual_booking',
          date: '2026-12-08',
          startTime: '16:45',
          paymentMethod: 'bar',
          includeInSettlement: true,
          override: true,
          form,
        });
        assertEquals(r.status, 409);
        assert(!r.body.needsOverride);
      });

      await t.step(
        'gesperrtes Fenster: erst Rückfrage, mit Override kostenlos gebucht',
        async () => {
          await db
            .from('blocked_slots')
            .insert({ date: '2026-12-08', start_time: '19:00', reason: 'Integrationstest' });
          const base = {
            action: 'manual_booking',
            date: '2026-12-08',
            startTime: '19:00',
            paymentMethod: 'kostenlos',
            includeInSettlement: true,
            form,
          };
          const ask = await call(base);
          assertEquals(ask.status, 409);
          assertEquals(ask.body.needsOverride, true);
          const ok = await call({ ...base, override: true });
          assertEquals(ok.status, 200, JSON.stringify(ok.body));
          ids.push(ok.body.bookingId);
          const { data: b } = await db
            .from('bookings')
            .select('amount_total_cents, include_in_settlement, admin_override')
            .eq('id', ok.body.bookingId)
            .single();
          assertEquals(b!.amount_total_cents, 0);
          assertEquals(b!.include_in_settlement, false);
          assertEquals(b!.admin_override, true);
        },
      );

      await t.step('Ticket erneut senden', async () => {
        const r = await call({ action: 'resend_ticket', booking_id: ids[0] });
        assertEquals(r.status, 200, JSON.stringify(r.body));
      });

      await t.step('bestehendem Nutzer die Händler-Rolle geben', async () => {
        const other = `haendler-${crypto.randomUUID().slice(0, 8)}@example.de`;
        const { data: u } = await db.auth.admin.createUser({ email: other, email_confirm: true });
        const r = await call({
          action: 'invite_user',
          email: other.toUpperCase(),
          role: 'haendler',
        });
        assertEquals(r.status, 200, JSON.stringify(r.body));
        const { data: roles } = await db
          .from('user_roles')
          .select('role')
          .eq('user_id', u.user!.id);
        assertEquals(roles, [{ role: 'haendler' }]);
        await db.auth.admin.deleteUser(u.user!.id);
      });

      await t.step(
        'neuen Zugang einladen → Einladungs-Mail mit Link auf /login/neues-passwort',
        async () => {
          const invitee = `einladung-${crypto.randomUUID().slice(0, 8)}@example.de`;
          const r = await call({ action: 'invite_user', email: invitee, role: 'studio_admin' });
          assertEquals(r.status, 200, JSON.stringify(r.body));
          assertEquals(r.body.invited, true);
          const { data: roles } = await db
            .from('user_roles')
            .select('role')
            .eq('user_id', r.body.userId);
          assertEquals(roles, [{ role: 'studio_admin' }]);
          if (MAILPIT) {
            const search = await fetch(`${MAILPIT}/api/v1/search?query=to:${invitee}`);
            const found = (await search.json()) as { messages: { ID: string }[] };
            assertEquals(found.messages.length, 1);
            const msg = await fetch(`${MAILPIT}/api/v1/message/${found.messages[0].ID}`);
            const { HTML } = (await msg.json()) as { HTML: string };
            assert(
              decodeURIComponent(HTML.replaceAll('&amp;', '&')).includes('/login/neues-passwort'),
              'Weiterleitung auf /login/neues-passwort fehlt',
            );
          }
          await db.auth.admin.deleteUser(r.body.userId);
        },
      );
    } finally {
      if (ids.length) {
        await db.from('email_log').delete().in('booking_id', ids);
        await db.from('bookings').delete().in('id', ids);
      }
      await db.from('blocked_slots').delete().eq('reason', 'Integrationstest');
      await db.auth.admin.deleteUser(userId);
      await brevo.shutdown();
    }
  },
});
