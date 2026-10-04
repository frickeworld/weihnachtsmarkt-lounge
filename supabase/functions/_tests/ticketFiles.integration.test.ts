// Integrationstest ticket-files: PDF, Apple-Wallet-Pass (signiert, geprüft mit openssl), Google-Wallet-Link.
import { assert, assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1';
import { unzipSync } from 'fflate';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FN = Deno.env.get('FN_TICKET_FILES') ?? 'http://127.0.0.1:8107';
const CA_FILE = Deno.env.get('TEST_WALLET_CA_FILE')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const decodeJwtPayload = (jwt: string) =>
  JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));

async function sha1(bytes: Uint8Array) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes as Uint8Array<ArrayBuffer>));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.test({
  name: 'ticket-files: PDF, Apple Wallet und Google Wallet',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    // Website (Bilder für PDF und Pass) und Google-API simulieren
    const site = Deno.serve(
      { hostname: '127.0.0.1', port: 4173, onListen: () => {} },
      async (req) => {
        const path = new URL(req.url).pathname;
        try {
          return new Response(await Deno.readFile(`public${path}`));
        } catch {
          return new Response('not found', { status: 404 });
        }
      },
    );
    const google: { path: string; auth: string | null; body: string }[] = [];
    const googleApi = Deno.serve(
      { hostname: '127.0.0.1', port: 8198, onListen: () => {} },
      async (req) => {
        const path = new URL(req.url).pathname;
        google.push({ path, auth: req.headers.get('authorization'), body: await req.text() });
        if (path === '/token')
          return Response.json({ access_token: 'ya29.test', expires_in: 3600 });
        if (path.endsWith('/eventTicketClass'))
          return Response.json({}, { status: google.length > 2 ? 409 : 200 });
        return new Response('?', { status: 404 });
      },
    );

    const { data } = await db
      .from('bookings')
      .insert({
        date: '2026-12-12',
        start_time: '17:30',
        end_time: '19:30',
        status: 'paid',
        first_name: 'Wally',
        last_name: 'Wallet',
        email: 'wallet-integration@example.de',
        phone: '0123456',
        persons: 7,
      })
      .select('id, ticket_token, booking_code')
      .single();
    const b = data as { id: string; ticket_token: string; booking_code: string };
    const url = (format: string, token = b.ticket_token) => `${FN}?token=${token}&format=${format}`;

    try {
      await t.step('info meldet eingerichtete Wallets', async () => {
        const res = await fetch(`${FN}?format=info`);
        assertEquals(await res.json(), { apple: true, google: true });
      });

      await t.step('unbekannter Token → 404 als HTML-Seite', async () => {
        const res = await fetch(url('pdf', 'A'.repeat(32)));
        assertEquals(res.status, 404);
        assertStringIncludes(await res.text(), 'Ticket nicht gefunden');
      });

      await t.step('PDF zum Herunterladen', async () => {
        const res = await fetch(url('pdf'));
        assertEquals(res.status, 200);
        assertEquals(res.headers.get('content-type'), 'application/pdf');
        assertStringIncludes(
          res.headers.get('content-disposition') ?? '',
          `Ticket-${b.booking_code}.pdf`,
        );
        const bytes = new Uint8Array(await res.arrayBuffer());
        assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
      });

      await t.step('Apple Wallet: gültig signierter Pass mit QR-Code', async () => {
        const res = await fetch(url('apple'));
        assertEquals(res.status, 200, await res.clone().text());
        assertEquals(res.headers.get('content-type'), 'application/vnd.apple.pkpass');
        const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
        for (const f of [
          'pass.json',
          'manifest.json',
          'signature',
          'icon.png',
          'icon@2x.png',
          'logo.png',
        ])
          assert(files[f], `${f} fehlt`);
        const pass = JSON.parse(new TextDecoder().decode(files['pass.json']));
        assertEquals(pass.passTypeIdentifier, 'pass.test.lounge');
        assertEquals(pass.teamIdentifier, 'TEAMID1234');
        assertEquals(pass.serialNumber, b.booking_code);
        assertEquals(pass.barcodes[0].message, b.ticket_token);
        assertEquals(pass.relevantDate, '2026-12-12T17:30:00+01:00');
        assertEquals(pass.expirationDate, '2026-12-12T19:30:00+01:00');
        assert(
          !JSON.stringify(pass).includes('wallet-integration@example.de'),
          'keine E-Mail im Pass',
        );

        const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
        for (const [name, hash] of Object.entries(manifest))
          assertEquals(await sha1(files[name]!), hash, name);

        const dir = await Deno.makeTempDir();
        await Deno.writeFile(`${dir}/manifest.json`, files['manifest.json']!);
        await Deno.writeFile(`${dir}/signature`, files['signature']!);
        const verify = await new Deno.Command('openssl', {
          args: [
            'smime',
            '-verify',
            '-binary',
            '-inform',
            'DER',
            '-in',
            `${dir}/signature`,
            '-content',
            `${dir}/manifest.json`,
            '-CAfile',
            CA_FILE,
            '-purpose',
            'any',
            '-out',
            '/dev/null',
          ],
          stderr: 'piped',
        }).output();
        const msg = new TextDecoder().decode(verify.stderr);
        assert(verify.success, msg);
        assertMatch(msg, /Verification successful/);
        await Deno.remove(dir, { recursive: true });
      });

      await t.step(
        'Google Wallet: Klasse anlegen, Weiterleitung mit signiertem Ticket',
        async () => {
          const res = await fetch(url('google'), { redirect: 'manual' });
          assertEquals(res.status, 302, await res.clone().text());
          const location = res.headers.get('location') ?? '';
          assertMatch(
            location,
            /^https:\/\/pay\.google\.com\/gp\/v\/save\/[\w-]+\.[\w-]+\.[\w-]+$/,
          );
          const payload = decodeJwtPayload(location.split('/save/')[1]!);
          assertEquals(payload.iss, 'wallet@test.iam.gserviceaccount.com');
          assertEquals(payload.typ, 'savetowallet');
          assertEquals(payload.origins, ['http://127.0.0.1:4173']);
          const obj = payload.payload.eventTicketObjects[0];
          assertEquals(obj.barcode.value, b.ticket_token);
          assertEquals(obj.classId, '3388000000000000000.lounge_20261212_1730');
          assert(
            !JSON.stringify(payload).match(/Wally|Wallet@|wallet-integration/),
            'keine personenbezogenen Daten an Google',
          );

          assertEquals(google[0]!.path, '/token');
          const cls = google.find((g) => g.path.endsWith('/eventTicketClass'))!;
          assertEquals(cls.auth, 'Bearer ya29.test');
          const body = JSON.parse(cls.body);
          assertEquals(body.dateTime.start, '2026-12-12T17:30:00+01:00');
        },
      );

      await t.step('stornierte Buchung → kein Ticket mehr', async () => {
        await db
          .from('bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancel_reason: 'Test',
          })
          .eq('id', b.id);
        const res = await fetch(url('pdf'));
        assertEquals(res.status, 410);
        await res.body?.cancel();
      });
    } finally {
      await db.from('bookings').delete().eq('id', b.id);
      await site.shutdown();
      await googleApi.shutdown();
    }
  },
});
