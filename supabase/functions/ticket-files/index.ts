// ticket-files: öffentliche Downloads zum Ticket – nur mit dem geheimen ticket_token (Inhalt des QR-Codes).
//   GET ?format=info                 → { apple, google } (welche Wallets eingerichtet sind)
//   GET ?token=…&format=pdf          → PDF-Ticket
//   GET ?token=…&format=gift         → Geschenk-Karte mit Ticket (PDF)
//   GET ?token=…&format=ics          → Kalendereintrag (.ics)
//   GET ?token=…&format=apple        → Apple-Wallet-Pass (.pkpass)
//   GET ?token=…&format=google       → Weiterleitung zu „In Google Wallet speichern“
import { buildPkpass, type PassImages } from '../_shared/applePass.ts';
import { adminClient } from '../_shared/db.ts';
import { googleSaveUrl } from '../_shared/googleWallet.ts';
import { buildIcs } from '../_shared/ics.ts';
import { corsHeaders, requireEnv } from '../_shared/http.ts';
import {
  buildGiftPdf,
  buildTicketPdf,
  fetchAsset,
  loadTicketSettings,
  TICKET_COLUMNS,
  ticketCommon,
  type TicketBooking,
} from '../_shared/ticketDocs.ts';
import {
  appleWalletConfig,
  googleWalletConfig,
  walletAvailability,
} from '../_shared/walletConfig.ts';

const TOKEN = /^[A-Za-z0-9]{32}$/;

/** Kleine HTML-Seite für Fehler – der Link wird direkt im Browser geöffnet. */
function page(status: number, title: string, text: string): Response {
  const site = (Deno.env.get('PUBLIC_SITE_URL') ?? '').replace(/\/$/, '');
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#FBF7EF;color:#23201B;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center">
<div style="max-width:420px"><h1 style="font-weight:500">${title}</h1><p style="color:#5F574B;line-height:1.5">${text}</p>
${site ? `<p><a href="${site}" style="color:#7A5A1E;font-weight:bold">Zur Website</a></p>` : ''}</div></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'pdf';

  if (format === 'info') {
    return new Response(JSON.stringify(walletAvailability()), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  const token = url.searchParams.get('token') ?? '';
  if (!TOKEN.test(token))
    return page(404, 'Ticket nicht gefunden', 'Bitte öffne den Link aus deiner Ticket-Mail.');

  const db = adminClient();
  const { data: b } = await db
    .from('bookings')
    .select(TICKET_COLUMNS)
    .eq('ticket_token', token)
    .maybeSingle<TicketBooking>();
  if (!b || b.anonymized_at)
    return page(404, 'Ticket nicht gefunden', 'Bitte öffne den Link aus deiner Ticket-Mail.');
  if (b.status !== 'paid')
    return page(
      410,
      'Ticket ungültig',
      'Diese Buchung ist nicht (mehr) gültig. Bei Fragen melde dich gern bei uns.',
    );

  const s = await loadTicketSettings(db);
  const siteUrl = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  const common = ticketCommon(b, s);
  const noStore = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };

  try {
    if (format === 'pdf') {
      const pdf = await buildTicketPdf(b, s, siteUrl);
      return new Response(pdf as Uint8Array<ArrayBuffer>, {
        headers: {
          ...noStore,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Ticket-${b.booking_code}.pdf"`,
        },
      });
    }

    if (format === 'gift') {
      const pdf = await buildGiftPdf(b, s, siteUrl);
      return new Response(pdf as Uint8Array<ArrayBuffer>, {
        headers: {
          ...noStore,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Geschenk-Lounge-${b.booking_code}.pdf"`,
        },
      });
    }

    if (format === 'ics') {
      const ics = buildIcs({
        uid: `${b.id}@lounge`,
        date: b.date,
        startTime: common.startTime,
        endTime: common.endTime,
        persons: b.persons,
        talerCount: common.talerCount,
        bookingCode: b.booking_code,
        location: s.lounge_location,
        ticketUrl: `${siteUrl}/ticket/${b.ticket_token}`,
      });
      return new Response(ics, {
        headers: {
          ...noStore,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="Lounge-${b.booking_code}.ics"`,
        },
      });
    }

    if (format === 'apple') {
      const cfg = appleWalletConfig();
      if (!cfg)
        return page(
          503,
          'Apple Wallet noch nicht verfügbar',
          'Bitte nutze das PDF-Ticket oder das Online-Ticket.',
        );
      const names = [
        'icon.png',
        'icon@2x.png',
        'icon@3x.png',
        'logo.png',
        'logo@2x.png',
        'logo@3x.png',
      ] as const;
      const fetched = await Promise.all(names.map((n) => fetchAsset(`${siteUrl}/wallet/${n}`)));
      const images: PassImages = {};
      names.forEach((n, i) => {
        if (fetched[i]) images[n] = fetched[i]!;
      });
      const pkpass = await buildPkpass(
        cfg,
        {
          token: b.ticket_token,
          bookingCode: b.booking_code,
          date: b.date,
          startTime: common.startTime,
          endTime: common.endTime,
          dateLabel: common.dateLabel,
          persons: b.persons,
          talerCount: common.talerCount,
          location: s.lounge_location,
          contactEmail: s.contact_email,
          siteUrl,
        },
        images,
      );
      return new Response(pkpass as Uint8Array<ArrayBuffer>, {
        headers: {
          ...noStore,
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="Lounge-${b.booking_code}.pkpass"`,
        },
      });
    }

    if (format === 'google') {
      const cfg = googleWalletConfig();
      if (!cfg)
        return page(
          503,
          'Google Wallet noch nicht verfügbar',
          'Bitte nutze das PDF-Ticket oder das Online-Ticket.',
        );
      const target = await googleSaveUrl(cfg, {
        bookingId: b.id,
        token: b.ticket_token,
        bookingCode: b.booking_code,
        date: b.date,
        startTime: common.startTime,
        endTime: common.endTime,
        persons: b.persons,
        talerCount: common.talerCount,
        location: s.lounge_location,
        siteUrl,
      });
      return new Response(null, { status: 302, headers: { ...noStore, Location: target } });
    }
  } catch (e) {
    console.error(`ticket-files ${format} ${b.id}`, e);
    return page(
      500,
      'Das hat gerade nicht geklappt',
      'Bitte versuch es gleich noch einmal oder nutze das PDF aus deiner Ticket-Mail.',
    );
  }

  return page(400, 'Unbekanntes Format', 'Bitte öffne den Link aus deiner Ticket-Mail.');
});
