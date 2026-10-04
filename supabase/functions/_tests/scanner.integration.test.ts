// Integrationstest Scanner: PIN → Token, Liste „Heute“, Scan, Taler, Abmeldung durch PIN-Wechsel.
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FN = Deno.env.get('FN_SCANNER') ?? 'http://127.0.0.1:8108';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const device = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
const call = async (body: Record<string, unknown>) => {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': device },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

Deno.test({
  name: 'scanner: PIN, Heute, Scan, Taler, Abmeldung',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const { data: before } = await db
      .from('settings')
      .select('scanner_pin_hash, scanner_token_version')
      .eq('id', 1)
      .single<{ scanner_pin_hash: string | null; scanner_token_version: number }>();
    // pgcrypto versteht bcrypt im Format $2a$
    await db
      .from('settings')
      .update({ scanner_pin_hash: bcrypt.hashSync('482915', 4) })
      .eq('id', 1);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(
      new Date(),
    );
    const { data } = await db
      .from('bookings')
      .insert({
        date: today,
        start_time: '00:00',
        end_time: '23:59',
        status: 'paid',
        first_name: 'Sina',
        last_name: 'Scanner',
        email: 'scanner-integration@example.de',
        phone: '0123456',
        persons: 5,
        company_name: 'Scan GmbH',
        paid_at: new Date().toISOString(),
      })
      .select('id, ticket_token, booking_code')
      .single();
    const b = data as { id: string; ticket_token: string; booking_code: string };
    let token = '';

    try {
      await t.step('falsche PIN → Hinweis mit Restversuchen', async () => {
        const r = await call({ action: 'auth', pin: '000000' });
        assertEquals(r.status, 401);
        assertMatch(r.body.message, /Noch 4 Versuche/);
      });

      await t.step('richtige PIN → Token für 12 Stunden', async () => {
        const r = await call({ action: 'auth', pin: '482915' });
        assertEquals(r.status, 200, JSON.stringify(r.body));
        token = r.body.token;
        const hours = (Date.parse(r.body.expiresAt) - Date.now()) / 3_600_000;
        assert(hours > 11.9 && hours <= 12, `${hours}`);
      });

      await t.step('ohne gültiges Token → 401', async () => {
        assertEquals((await call({ action: 'today', token: 'kaputt.token' })).status, 401);
        assertEquals((await call({ action: 'today' })).status, 401);
      });

      await t.step('Liste „Heute“ mit Token-Hash, ohne Kontaktdaten', async () => {
        const r = await call({ action: 'today', token });
        assertEquals(r.body.date, today);
        const row = r.body.bookings.find((x: { id: string }) => x.id === b.id);
        assertEquals(row.company_name, 'Scan GmbH');
        assertEquals(row.token_hash.length, 64);
        assert(!JSON.stringify(r.body).includes('scanner-integration@example.de'));
        assert(!JSON.stringify(r.body).includes(b.ticket_token));
      });

      await t.step('QR scannen → grün, nochmal → gelb', async () => {
        const ok = await call({ action: 'scan', token, code: b.ticket_token });
        assertEquals(ok.body.result, 'ok');
        assertEquals(ok.body.booking.first_name, 'Sina');
        const again = await call({ action: 'scan', token, code: b.booking_code });
        assertEquals(again.body.result, 'already');
      });

      await t.step('Taler übergeben', async () => {
        const r = await call({ action: 'taler', token, bookingId: b.id });
        assertEquals(r.body.ok, true);
        assert(r.body.booking.taler_handed_out_at);
      });

      await t.step('Offline-Nachtrag eines erfundenen Codes → rot, protokolliert', async () => {
        const r = await call({
          action: 'scan',
          token,
          code: 'HL-NEIN-NEIN',
          offline: true,
          scannedAt: new Date(Date.now() - 60_000).toISOString(),
        });
        assertEquals(r.body.result, 'invalid');
        const { count } = await db
          .from('scan_log')
          .select('id', { count: 'exact', head: true })
          .eq('booking_id', b.id);
        assertEquals(count, 3);
      });

      await t.step('neue PIN im Admin → alter Token ungültig', async () => {
        await db
          .from('settings')
          .update({ scanner_token_version: (before?.scanner_token_version ?? 1) + 1 })
          .eq('id', 1);
        const r = await call({ action: 'today', token });
        assertEquals(r.status, 401);
        assertMatch(r.body.message, /PIN neu an/);
      });
    } finally {
      await db.from('scan_log').delete().in('code_entered', ['HL-NEIN-NEIN', b.booking_code]);
      await db.from('bookings').delete().eq('id', b.id);
      await db.from('scanner_attempts').delete().neq('ip_hash', '');
      await db
        .from('settings')
        .update({
          scanner_pin_hash: before?.scanner_pin_hash ?? null,
          scanner_token_version: before?.scanner_token_version ?? 1,
        })
        .eq('id', 1);
    }
  },
});
