// Integrationstest Warteliste: Eintrag nur an ausgebuchten Tagen, eine Mail sobald frei, dann gelöscht.
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FN_WAITLIST = Deno.env.get('FN_WAITLIST') ?? 'http://127.0.0.1:8110';
const FN_SEND = Deno.env.get('FN_SEND_WAITLIST') ?? 'http://127.0.0.1:8111';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Ein Dienstag in 20–26 Tagen (drei Zeitfenster: 14:30, 16:45, 19:00)
const day = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 20);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const device = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
const join = (body: Record<string, unknown>) =>
  fetch(FN_WAITLIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': device },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

Deno.test({
  name: 'waitlist: Eintrag, Benachrichtigung, Löschung',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const mails: Record<string, unknown>[] = [];
    const brevo = Deno.serve(
      { hostname: '127.0.0.1', port: 8199, onListen: () => {} },
      async (req) => {
        mails.push(await req.json());
        return Response.json({ messageId: 'm1' }, { status: 201 });
      },
    );
    const { data: original } = await db
      .from('settings')
      .select('season_start, season_end')
      .eq('id', 1)
      .single();
    await db
      .from('settings')
      .update({ season_start: new Date().toISOString().slice(0, 10), season_end: '2099-12-31' })
      .eq('id', 1);
    await db.from('waitlist').delete().eq('date', day);
    await db.from('bookings').delete().eq('email', 'warteliste-test@example.de');
    await db.from('checkout_attempts').delete().like('ip_hash', 'waitlist:%');

    try {
      await t.step('Tag mit freiem Zeitfenster → 409 „direkt buchen“', async () => {
        const r = await join({ date: day, email: 'gast@example.de', consent: true });
        assertEquals(r.status, 409);
        assertEquals(r.body.freeNow, true);
      });

      const ids: string[] = [];
      await t.step('Tag ausbuchen, eintragen (doppelt egal), Einwilligung Pflicht', async () => {
        for (const [st, et] of [
          ['14:30', '16:30'],
          ['16:45', '18:45'],
          ['19:00', '21:00'],
        ]) {
          const { data, error } = await db
            .from('bookings')
            .insert({
              date: day,
              start_time: st,
              end_time: et,
              status: 'pending',
              first_name: 'W',
              last_name: 'Test',
              email: 'warteliste-test@example.de',
              phone: '0123456',
              persons: 2,
              hold_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
            })
            .select('id')
            .single();
          assert(!error, error?.message);
          ids.push(data!.id);
        }
        const noConsent = await join({ date: day, email: 'gast@example.de', consent: false });
        assertEquals(noConsent.status, 400);
        assertEquals(Object.keys(noConsent.body.fields), ['consent']);
        assertEquals(
          (await join({ date: day, email: ' Gast@Example.de ', consent: true })).status,
          200,
        );
        assertEquals(
          (await join({ date: day, email: 'gast@example.de', consent: true })).status,
          200,
        );
        const { data: rows } = await db.from('waitlist').select('email').eq('date', day);
        assertEquals(rows, [{ email: 'gast@example.de' }]);
      });

      await t.step('send-waitlist ohne Berechtigung → 401', async () => {
        const r = await fetch(FN_SEND, { method: 'POST', body: '{}' });
        assertEquals(r.status, 401);
        await r.body?.cancel();
      });

      const send = () =>
        fetch(FN_SEND, {
          method: 'POST',
          headers: { 'x-cron-secret': Deno.env.get('CRON_SECRET')! },
          body: '{}',
        }).then((r) => r.json());

      await t.step('noch ausgebucht → keine Mail', async () => {
        assertEquals((await send()).sent, 0);
        assertEquals(mails.length, 0);
      });

      await t.step('Zeitfenster frei → eine Mail mit Link, Eintrag gelöscht', async () => {
        await db.from('bookings').delete().eq('id', ids[1]!);
        assertEquals((await send()).sent, 1);
        const m = mails[0] as { to: { email: string }[]; subject: string; textContent: string };
        assertEquals(m.to[0]!.email, 'gast@example.de');
        assertMatch(m.subject, /^Wieder frei: Lounge am /);
        assertMatch(m.textContent, /16:45–18:45 Uhr · 149 €/);
        assertMatch(m.textContent, new RegExp(`/\\?datum=${day}#buchen`));
        const { count } = await db
          .from('waitlist')
          .select('id', { count: 'exact', head: true })
          .eq('date', day);
        assertEquals(count, 0);
        assertEquals((await send()).sent, 0);
      });
    } finally {
      await db.from('bookings').delete().eq('email', 'warteliste-test@example.de');
      await db.from('waitlist').delete().eq('date', day);
      await db.from('settings').update(original!).eq('id', 1);
      await brevo.shutdown();
    }
  },
});
