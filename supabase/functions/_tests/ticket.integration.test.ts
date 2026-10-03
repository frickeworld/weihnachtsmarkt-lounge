// Integrationstest Ticketversand: echte Datenbank + Storage, echte Edge Functions, Brevo-Simulator.
import { assert, assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FN_TICKET = Deno.env.get('FN_SEND_TICKET') ?? 'http://127.0.0.1:8104';
const FN_REMINDERS = Deno.env.get('FN_SEND_REMINDERS') ?? 'http://127.0.0.1:8105';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Captured {
  path: string;
  body: Record<string, unknown>;
}

Deno.test({
  name: 'send-ticket: QR-Code, PDF, Brevo-Mail, Kontaktliste und Double-Opt-in',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const captured: Captured[] = [];
    let failMail = false;
    const brevo = Deno.serve(
      { hostname: '127.0.0.1', port: 8199, onListen: () => {} },
      async (req) => {
        const path = new URL(req.url).pathname.replace(/^\/v3/, '');
        captured.push({ path, body: await req.json() });
        assertEquals(req.headers.get('api-key'), 'brevo_test_key');
        if (failMail && path === '/smtp/email')
          return new Response('{"message":"kaputt"}', { status: 500 });
        return Response.json({ messageId: 'm1' }, { status: 201 });
      },
    );

    const { data: booking } = await db
      .from('bookings')
      .insert({
        date: '2026-12-05',
        start_time: '17:30',
        end_time: '19:30',
        status: 'paid',
        first_name: 'Anna',
        last_name: 'Muster',
        email: 'ticket-integration@example.de',
        phone: '0123456',
        persons: 8,
        occasion: 'firmenfeier',
        company_name: 'Muster GmbH',
        newsletter_opt_in: true,
      })
      .select('id, ticket_token, booking_code')
      .single();
    const b = booking as { id: string; ticket_token: string; booking_code: string };

    const send = () =>
      fetch(FN_TICKET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ booking_id: b.id }),
      });

    try {
      await t.step('Ticket wird verschickt', async () => {
        const res = await send();
        assertEquals(res.status, 200, await res.clone().text());
      });

      await t.step('Mail: Empfänger, Betreff, Inhalt, PDF-Anhang', () => {
        const mail = captured.find((c) => c.path === '/smtp/email')!;
        assert(mail, 'keine Mail an Brevo');
        assertEquals(
          (mail.body.to as { email: string }[])[0]!.email,
          'ticket-integration@example.de',
        );
        assertEquals((mail.body.sender as { email: string }).email, 'tickets@studio-f.club');
        assertEquals(
          mail.body.subject,
          'Dein Ticket: Weihnachtsmarkt-Lounge am Samstag, 5. Dezember 2026',
        );
        assertStringIncludes(mail.body.htmlContent as string, b.booking_code);
        assertStringIncludes(mail.body.htmlContent as string, `/ticket/${b.ticket_token}`);
        const att = (mail.body.attachment as { name: string; content: string }[])[0]!;
        assertEquals(att.name, `Ticket-${b.booking_code}.pdf`);
        assert(atob(att.content).startsWith('%PDF'), 'Anhang ist kein PDF');
      });

      await t.step('QR-Code liegt öffentlich im Storage', async () => {
        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/public/tickets/${b.ticket_token}.png`,
        );
        assertEquals(res.status, 200);
        assertMatch(res.headers.get('content-type') ?? '', /image\/png/);
        await res.body?.cancel();
      });

      await t.step('Kontakt in „Lounge-Buchungen“, Newsletter nur per Double-Opt-in', () => {
        const contact = captured.find((c) => c.path === '/contacts')!;
        assertEquals(contact.body.listIds, [7]);
        assertEquals(contact.body.updateEnabled, true);
        assertEquals((contact.body.attributes as Record<string, string>).FIRMA, 'Muster GmbH');
        const doi = captured.find((c) => c.path === '/contacts/doubleOptinConfirmation')!;
        assertEquals(doi.body.includeListIds, [8]);
        assertEquals(doi.body.templateId, 9);
        assertMatch(doi.body.redirectionUrl as string, /\/newsletter\/bestaetigt$/);
      });

      await t.step('Erneut senden: Mail ja, Double-Opt-in nicht doppelt', async () => {
        captured.length = 0;
        assertEquals((await send()).status, 200);
        assert(captured.some((c) => c.path === '/smtp/email'));
        assert(!captured.some((c) => c.path === '/contacts/doubleOptinConfirmation'));
      });

      await t.step('Brevo-Fehler: 502 und Eintrag im email_log', async () => {
        failMail = true;
        const res = await send();
        assertEquals(res.status, 502);
        await res.body?.cancel();
        failMail = false;
        const { data: logs } = await db
          .from('email_log')
          .select('type, status')
          .eq('booking_id', b.id);
        const l = logs as { type: string; status: string }[];
        assertEquals(l.filter((x) => x.type === 'ticket' && x.status === 'sent').length, 2);
        assertEquals(l.filter((x) => x.type === 'ticket' && x.status === 'failed').length, 1);
        assertEquals(l.filter((x) => x.type === 'doi' && x.status === 'sent').length, 1);
      });

      await t.step('Nicht bezahlte Buchung bekommt kein Ticket (409)', async () => {
        await db.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
        const res = await send();
        assertEquals(res.status, 409);
        await res.body?.cancel();
      });

      await t.step('send-reminders nur mit Cron-Geheimnis', async () => {
        const no = await fetch(FN_REMINDERS, { method: 'POST', body: '{}' });
        assertEquals(no.status, 401);
        await no.body?.cancel();
        const yes = await fetch(FN_REMINDERS, {
          method: 'POST',
          headers: { 'x-cron-secret': 'cron_integration_test' },
          body: '{}',
        });
        assertEquals(yes.status, 200);
        assert('sent' in (await yes.json()));
      });
    } finally {
      await db.from('email_log').delete().eq('booking_id', b.id);
      await db.from('bookings').delete().eq('id', b.id);
      await db.storage.from('tickets').remove([`${b.ticket_token}.png`]);
      await brevo.shutdown();
    }
  },
});
