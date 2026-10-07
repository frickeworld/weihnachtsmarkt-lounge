// Integrationstest Tagesbericht: Inhalt, Empfänger, nur einmal je Tag, außerhalb der Saison nichts.
import { assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FN = Deno.env.get('FN_DAILY_REPORT') ?? 'http://127.0.0.1:8113';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Ein Samstag in der Zukunft (Zeitfenster 15:30, 17:45, 20:00)
const day = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

Deno.test({
  name: 'daily-report: Tagesbericht per Mail',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const mails: { to: { email: string }[]; subject: string; textContent: string }[] = [];
    const brevo = Deno.serve(
      { hostname: '127.0.0.1', port: 8199, onListen: () => {} },
      async (req) => {
        mails.push(await req.json());
        return Response.json({ messageId: 'm1' }, { status: 201 });
      },
    );
    const { data: original } = await db
      .from('settings')
      .select('season_start, season_end, daily_report_recipients')
      .eq('id', 1)
      .single();
    const call = (body: unknown) =>
      fetch(FN, {
        method: 'POST',
        headers: { 'x-cron-secret': Deno.env.get('CRON_SECRET')! },
        body: JSON.stringify(body),
      }).then((r) => r.json());
    try {
      await db.from('daily_reports').delete().eq('day', day);
      await db.from('bookings').delete().eq('email', 'bericht@example.de');

      await t.step('außerhalb der Saison: nichts', async () => {
        await db
          .from('settings')
          .update({ season_start: '2099-11-26', season_end: '2099-12-23' })
          .eq('id', 1);
        assertEquals(await call({ day }), { ok: true, skipped: 'out_of_season' });
        assertEquals(mails.length, 0);
      });

      await t.step('Bericht mit Buchung des Tages an alle Empfänger, nur einmal', async () => {
        await db
          .from('settings')
          .update({
            season_start: day,
            season_end: day,
            daily_report_recipients: ['haendler@example.de'],
          })
          .eq('id', 1);
        await db.from('bookings').insert({
          date: day,
          start_time: '17:45',
          end_time: '19:45',
          status: 'paid',
          first_name: 'Bea',
          last_name: 'Bericht',
          email: 'bericht@example.de',
          phone: '0123456',
          persons: 7,
          notes: 'Geburtstag',
          paid_at: new Date().toISOString(),
        });
        const r = await call({ day });
        assertEquals(r, { ok: true, sent: 2 });
        assertEquals(mails.map((m) => m.to[0]!.email).sort(), [
          'haendler@example.de',
          'info@studio-f.club',
        ]);
        assertMatch(mails[0]!.subject, /^Lounge heute: 1 Buchung/);
        assertMatch(
          mails[0]!.textContent,
          /17:45–19:45: Bea Bericht, 7 Pers\., Wunsch: Geburtstag/,
        );
        assertMatch(mails[0]!.textContent, /Frei in den nächsten 7 Tagen: 2 von 3/);
        assertEquals(await call({ day }), { ok: true, skipped: 'already_sent' });
        assertEquals(mails.length, 2);
      });
    } finally {
      await db.from('bookings').delete().eq('email', 'bericht@example.de');
      await db.from('daily_reports').delete().eq('day', day);
      await db.from('settings').update(original!).eq('id', 1);
      await brevo.shutdown();
    }
  },
});
