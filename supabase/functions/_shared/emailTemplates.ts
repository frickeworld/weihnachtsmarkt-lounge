// E-Mail-Vorlagen für Ticket und Erinnerung. Reine Funktionen ohne Deno-/Browser-APIs,
// damit sie auch mit Vitest getestet werden können. Alle Gast-Eingaben werden HTML-escaped.
import { legalLine } from './legal.ts';

export interface TicketMailData {
  kind: 'ticket' | 'reminder';
  firstName: string;
  dateLabel: string; // „Samstag, 5. Dezember 2026“
  startTime: string; // „17:30“
  endTime: string; // „19:30“
  persons: number;
  bookingCode: string;
  qrImageUrl: string;
  ticketUrl: string;
  /** PDF zum Herunterladen (zusätzlich zum Anhang) */
  pdfUrl?: string | null;
  /** Kalendereintrag (.ics) */
  icsUrl?: string | null;
  /** „In Google Kalender eintragen“ */
  googleCalendarUrl?: string | null;
  /** Nur gesetzt, wenn das jeweilige Wallet eingerichtet ist */
  appleWalletUrl?: string | null;
  googleWalletUrl?: string | null;
  invoiceUrl?: string | null;
  talerCount: number;
  location: string;
  siteUrl: string;
  contactEmail: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helles Design (Design-Runde 2): Papier, weiße Karte, dunkle Schrift, Gold-Glitzer-Kopf.
const C = {
  paper: '#FBF7EF',
  surface: '#FFFFFF',
  sand: '#F3EBDC',
  line: '#E4D8C2',
  ink: '#23201B',
  inkSoft: '#5F574B',
  gold: '#C6A45C',
  goldDeep: '#7A5A1E',
  brown: '#24221E',
  onDark: '#F8F3E8',
};

/** Schwarze Wallet-Buttons (Platzhalter für die offiziellen Badges von Apple und Google). */
function walletButtons(d: Pick<TicketMailData, 'appleWalletUrl' | 'googleWalletUrl'>): string {
  const btn = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:4px;background:#000000;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 20px;border-radius:10px;">${label}</a>`;
  const buttons = [
    d.appleWalletUrl ? btn(d.appleWalletUrl, 'Zu Apple Wallet hinzufügen') : '',
    d.googleWalletUrl ? btn(d.googleWalletUrl, 'In Google Wallet speichern') : '',
  ].join('');
  return buttons ? `<tr><td align="center" style="padding:12px 24px 0;">${buttons}</td></tr>` : '';
}

export function ticketSubject(d: Pick<TicketMailData, 'kind' | 'dateLabel' | 'startTime'>): string {
  return d.kind === 'reminder'
    ? `Heute ist es so weit: deine Lounge um ${d.startTime} Uhr`
    : `Dein Ticket: Weihnachtsmarkt-Lounge am ${d.dateLabel}`;
}

export function renderTicketEmail(d: TicketMailData): {
  subject: string;
  html: string;
  text: string;
} {
  const e = {
    firstName: escapeHtml(d.firstName),
    location: escapeHtml(d.location),
    code: escapeHtml(d.bookingCode),
  };
  const subject = ticketSubject(d);
  const site = d.siteUrl.replace(/\/$/, '');
  const intro =
    d.kind === 'reminder'
      ? `Hallo ${e.firstName}, heute Abend ist es so weit – deine Lounge wartet auf dich!`
      : `Hallo ${e.firstName}, deine Lounge ist gebucht!`;
  const preheader =
    d.kind === 'reminder'
      ? `Heute um ${d.startTime} Uhr: Zeig einfach diesen QR-Code am Einlass.`
      : `${d.dateLabel}, ${d.startTime}–${d.endTime} Uhr · Buchungscode ${d.bookingCode}`;

  const row = (label: string, value: string) => `
              <tr>
                <td style="padding:8px 0;color:${C.inkSoft};font-size:14px;">${label}</td>
                <td style="padding:8px 0;color:${C.ink};font-size:14px;text-align:right;font-weight:bold;">${value}</td>
              </tr>`;

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.surface};border:1px solid ${C.line};border-radius:18px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
      <tr><td style="padding:0;background:${C.gold};">
        <img src="${escapeHtml(site)}/email/kopf.jpg" width="600" alt="Weihnachtsmarkt im Schlosspark Detmold" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
      </td></tr>
      <tr><td align="center" style="padding:32px 32px 0;">
        <p style="margin:0;color:${C.goldDeep};font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Deine Lounge</p>
        <h1 style="margin:12px 0 0;color:${C.ink};font-family:'Century Gothic','Avenir Next',Helvetica,Arial,sans-serif;font-weight:normal;font-size:28px;line-height:1.3;">${intro}</h1>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
        <p style="margin:0;color:${C.ink};font-family:'Century Gothic','Avenir Next',Helvetica,Arial,sans-serif;font-size:26px;">${escapeHtml(d.dateLabel)}</p>
        <p style="margin:6px 0 0;color:${C.goldDeep};font-size:20px;font-weight:bold;">${d.startTime}–${d.endTime} Uhr</p>
      </td></tr>
      <tr><td align="center" style="padding:20px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid ${C.line};border-radius:16px;">
          <tr><td style="padding:16px;">
            <img src="${escapeHtml(d.qrImageUrl)}" width="240" height="240" alt="QR-Code für Buchung ${e.code}" style="display:block;width:240px;height:240px;border:0;">
          </td></tr>
        </table>
        <p style="margin:12px 0 0;color:${C.inkSoft};font-size:13px;">Buchungscode</p>
        <p style="margin:4px 0 0;color:${C.ink};font-size:20px;letter-spacing:2px;font-family:'Courier New',monospace;font-weight:bold;">${e.code}</p>
        <p style="margin:12px 0 0;color:${C.inkSoft};font-size:13px;">Zeig den QR-Code am Einlass – ausgedruckt oder auf dem Handy. Das Ticket hängt zusätzlich als PDF an.</p>
      </td></tr>
      <tr><td style="padding:8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};">
          ${row('Personen', String(d.persons))}
          <tr>
            <td colspan="2" style="padding:8px 0 12px;color:${C.inkSoft};font-size:14px;">Ort<br><span style="color:${C.ink};">${e.location}</span></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sand};border-radius:14px;">
          <tr><td style="padding:18px 20px;color:${C.ink};font-size:15px;line-height:1.6;">
            <p style="margin:0 0 8px;font-weight:bold;font-size:17px;">Was dich erwartet</p>
            <p style="margin:0 0 6px;">&#10022; <strong>${d.talerCount} € Freiverzehr</strong>: ${d.talerCount} Residenztaler beim Einlass – je 1 €, an den Ständen einlösbar, pro gekauftem Artikel 1 Taler.</p>
            <p style="margin:0;">&#10022; Tischservice der Tanzschule Fricke direkt an eurem Platz.</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 0;color:${C.ink};font-size:15px;line-height:1.6;">
        <p style="margin:0 0 6px;">Bitte sei pünktlich – dein Zeitfenster endet um ${d.endTime} Uhr.</p>
        <p style="margin:0;color:${C.inkSoft};font-size:14px;">Deine Buchung ist verbindlich. Du kannst dein Ticket aber an andere weitergeben.</p>
      </td></tr>
      <tr><td align="center" style="padding:28px 32px 8px;">
        <a href="${escapeHtml(d.ticketUrl)}" style="display:inline-block;background:${C.gold};color:${C.ink};text-decoration:none;font-weight:bold;font-size:16px;padding:14px 30px;border-radius:999px;">Ticket online öffnen</a>
      </td></tr>
      ${walletButtons(d)}
      ${
        d.pdfUrl
          ? `<tr><td align="center" style="padding:8px 32px 0;"><a href="${escapeHtml(d.pdfUrl)}" style="color:${C.goldDeep};font-size:14px;font-weight:bold;">Ticket als PDF herunterladen</a></td></tr>`
          : ''
      }
      ${
        d.icsUrl
          ? `<tr><td align="center" style="padding:8px 32px 0;"><a href="${escapeHtml(d.icsUrl)}" style="color:${C.goldDeep};font-size:14px;font-weight:bold;">In den Kalender eintragen</a>${
              d.googleCalendarUrl
                ? ` &middot; <a href="${escapeHtml(d.googleCalendarUrl)}" style="color:${C.goldDeep};font-size:14px;font-weight:bold;">Google Kalender</a>`
                : ''
            }</td></tr>`
          : ''
      }
      ${
        d.invoiceUrl
          ? `<tr><td align="center" style="padding:8px 32px 0;"><a href="${escapeHtml(d.invoiceUrl)}" style="color:${C.goldDeep};font-size:14px;font-weight:bold;">Rechnung ansehen</a></td></tr>`
          : ''
      }
      <tr><td style="padding:28px 0 0;"></td></tr>
      <tr><td style="padding:24px 32px;background:${C.brown};color:${C.onDark};font-size:12px;line-height:1.6;">
        <img src="${escapeHtml(site)}/email/haendler-logo-weiss.png" width="170" alt="Die Händler – Wir handeln für Detmold." style="display:block;width:170px;height:auto;border:0;margin:0 0 12px;">
        <p style="margin:0 0 4px;">Fragen? Schreib uns an <a href="mailto:${escapeHtml(d.contactEmail)}" style="color:${C.onDark};">${escapeHtml(d.contactEmail)}</a>.</p>
        <p style="margin:0 0 4px;">Eine Aktion der Händler – Werbegemeinschaft Detmold e. V.</p>
        <p style="margin:0 0 4px;opacity:0.8;">${escapeHtml(legalLine())}</p>
        <p style="margin:12px 0 0;opacity:0.7;">Powered by <a href="https://www.studio-f.club" style="color:${C.onDark};">STUDIO/F</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    d.kind === 'reminder'
      ? `Hallo ${d.firstName}, heute Abend ist es so weit – deine Lounge wartet auf dich!`
      : `Hallo ${d.firstName}, deine Lounge ist gebucht!`,
    '',
    `${d.dateLabel}, ${d.startTime}–${d.endTime} Uhr`,
    `Buchungscode: ${d.bookingCode}`,
    `Personen: ${d.persons}`,
    `Ort: ${d.location}`,
    '',
    `Dein Ticket online: ${d.ticketUrl}`,
    'Das Ticket hängt zusätzlich als PDF an. Zeig den QR-Code am Einlass.',
    ...(d.appleWalletUrl ? [`Zu Apple Wallet hinzufügen: ${d.appleWalletUrl}`] : []),
    ...(d.googleWalletUrl ? [`In Google Wallet speichern: ${d.googleWalletUrl}`] : []),
    ...(d.icsUrl ? [`In den Kalender eintragen: ${d.icsUrl}`] : []),
    ...(d.googleCalendarUrl ? [`In Google Kalender eintragen: ${d.googleCalendarUrl}`] : []),
    '',
    'Was dich erwartet:',
    `- ${d.talerCount} € Freiverzehr: ${d.talerCount} Residenztaler beim Einlass (je 1 €, pro gekauftem Artikel 1 Taler)`,
    '- Tischservice der Tanzschule Fricke',
    '',
    `Bitte sei pünktlich – dein Zeitfenster endet um ${d.endTime} Uhr.`,
    'Deine Buchung ist verbindlich. Du kannst dein Ticket aber an andere weitergeben.',
    ...(d.invoiceUrl ? ['', `Rechnung: ${d.invoiceUrl}`] : []),
    '',
    `Fragen? ${d.contactEmail}`,
    'Eine Aktion der Händler – Werbegemeinschaft Detmold e. V.',
    legalLine(),
    'Powered by STUDIO/F – https://www.studio-f.club',
  ].join('\n');

  return { subject, html, text };
}
