// Integrationstest Kontaktformular: Mail an STUDIO/F mit Reply-To, Honigtopf, Prüfung, Begrenzung.
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';

const FN = Deno.env.get('FN_CONTACT') ?? 'http://127.0.0.1:8109';
const device = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
const send = (body: Record<string, unknown>) =>
  fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': device },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

const valid = {
  name: 'Anna Muster',
  email: 'anna-kontakt@example.de',
  topic: 'ticket',
  bookingCode: 'hlabcdefgh',
  message: 'Ich habe nach der Zahlung kein Ticket bekommen.',
  website: '',
};

Deno.test({
  name: 'contact: Nachricht an STUDIO/F',
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
    try {
      await t.step('ungültige Angaben → 400 mit Feldern', async () => {
        const r = await send({ ...valid, email: 'kaputt', message: 'kurz' });
        assertEquals(r.status, 400);
        assertEquals(Object.keys(r.body.fields).sort(), ['email', 'message']);
        assertEquals(mails.length, 0);
      });

      await t.step('gültig → Mail an info@studio-f.club, Antwort geht an den Gast', async () => {
        const r = await send(valid);
        assertEquals(r.status, 200, JSON.stringify(r.body));
        const m = mails[0] as {
          to: { email: string }[];
          replyTo: { email: string };
          subject: string;
          textContent: string;
        };
        assertEquals(m.to[0]!.email, 'info@studio-f.club');
        assertEquals(m.replyTo.email, 'anna-kontakt@example.de');
        assertMatch(m.subject, /Kein Ticket bekommen \(HL-ABCD-EFGH\)/);
        assertMatch(m.textContent, /kein Ticket bekommen/);
      });

      await t.step('Honigtopf ausgefüllt → „ok“, aber keine Mail', async () => {
        const before = mails.length;
        const r = await send({ ...valid, website: 'http://spam.example' });
        assertEquals(r.body.ok, true);
        assertEquals(mails.length, before);
      });

      await t.step('Firmenanfrage → eigene Mail mit Zeitfenstern und Personen', async () => {
        const before = mails.length;
        const bad = await send({ kind: 'gruppe', company: '', name: 'X', email: 'x@example.de' });
        assertEquals(bad.status, 400);
        assert(bad.body.fields.company);
        const r = await send({
          kind: 'gruppe',
          company: 'Muster GmbH',
          name: 'Frau Muster',
          email: 'firma@example.de',
          phone: '05231 123456',
          slots: 3,
          persons: 28,
          dates: 'Fr 4.12. ab 15:30',
          message: '',
          website: '',
        });
        assertEquals(r.status, 200, JSON.stringify(r.body));
        const m = mails[before] as {
          to: { email: string }[];
          replyTo: { email: string };
          subject: string;
          textContent: string;
          tags: string[];
        };
        assertEquals(m.to[0]!.email, 'info@studio-f.club');
        assertEquals(m.replyTo.email, 'firma@example.de');
        assertEquals(m.subject, 'Firmenanfrage: Muster GmbH – 3 Zeitfenster, 28 Personen');
        assertMatch(m.textContent, /Wunschtermine: Fr 4\.12\. ab 15:30/);
        assertEquals(m.tags, ['lounge-firmenanfrage']);
      });

      await t.step('mehr als 5 Nachrichten pro Stunde → 429', async () => {
        let last = 0;
        for (let i = 0; i < 5; i++) last = (await send(valid)).status;
        assertEquals(last, 429);
      });
    } finally {
      await brevo.shutdown();
    }
  },
});
