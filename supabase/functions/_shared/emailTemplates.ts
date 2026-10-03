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

const C = {
  night: '#0F0D0B',
  coal: '#1A1714',
  gold: '#C9A24D',
  champagne: '#E9D8A6',
  cream: '#F6EFE3',
  muted: '#BDB3A3',
};

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
                <td style="padding:6px 0;color:${C.muted};font-size:14px;">${label}</td>
                <td style="padding:6px 0;color:${C.cream};font-size:14px;text-align:right;">${value}</td>
              </tr>`;

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.night};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.night};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.coal};border-top:3px solid ${C.gold};font-family:Helvetica,Arial,sans-serif;">
      <tr><td align="center" style="padding:32px 24px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:${C.cream};border:1px solid ${C.gold};">
          <tr><td style="padding:12px 18px;">
            <img src="${escapeHtml(site)}/email/haendler-logo.png" width="220" alt="Die Händler – Wir handeln für Detmold." style="display:block;width:220px;height:auto;border:0;">
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:20px 32px 0;">
        <p style="margin:0;color:${C.champagne};font-size:12px;letter-spacing:3px;text-transform:uppercase;">Weihnachtsmarkt im Schlosspark Detmold</p>
        <h1 style="margin:14px 0 0;color:${C.cream};font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.3;">${intro}</h1>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
        <p style="margin:0;color:${C.champagne};font-family:Georgia,'Times New Roman',serif;font-size:26px;">${escapeHtml(d.dateLabel)}</p>
        <p style="margin:6px 0 0;color:${C.cream};font-size:20px;">${d.startTime}–${d.endTime} Uhr</p>
      </td></tr>
      <tr><td align="center" style="padding:20px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:4px;">
          <tr><td style="padding:16px;">
            <img src="${escapeHtml(d.qrImageUrl)}" width="240" height="240" alt="QR-Code für Buchung ${e.code}" style="display:block;width:240px;height:240px;border:0;">
          </td></tr>
        </table>
        <p style="margin:12px 0 0;color:${C.muted};font-size:13px;">Buchungscode</p>
        <p style="margin:4px 0 0;color:${C.cream};font-size:20px;letter-spacing:2px;font-family:'Courier New',monospace;">${e.code}</p>
        <p style="margin:12px 0 0;color:${C.muted};font-size:13px;">Zeig den QR-Code am Einlass – ausgedruckt oder auf dem Handy. Das Ticket hängt zusätzlich als PDF an.</p>
      </td></tr>
      <tr><td style="padding:8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #3A3026;border-bottom:1px solid #3A3026;">
          ${row('Personen', String(d.persons))}
          <tr>
            <td colspan="2" style="padding:6px 0 10px;color:${C.muted};font-size:14px;">Ort<br><span style="color:${C.cream};">${e.location}</span></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px 0;color:${C.cream};font-size:15px;line-height:1.6;">
        <p style="margin:0 0 8px;color:${C.champagne};font-family:Georgia,'Times New Roman',serif;font-size:20px;">Was dich erwartet</p>
        <p style="margin:0 0 6px;">&#10022; ${d.talerCount} Residenztaler beim Einlass – je 1 €, an den Ständen des Weihnachtsmarkts einlösbar, pro gekauftem Artikel 1 Taler.</p>
        <p style="margin:0 0 6px;">&#10022; Tischservice der Tanzschule Fricke direkt an eurem Platz.</p>
        <p style="margin:16px 0 6px;">Bitte sei pünktlich – dein Zeitfenster endet um ${d.endTime} Uhr.</p>
        <p style="margin:0;color:${C.muted};font-size:14px;">Deine Buchung ist verbindlich. Du kannst dein Ticket aber an andere weitergeben.</p>
      </td></tr>
      <tr><td align="center" style="padding:28px 32px 8px;">
        <a href="${escapeHtml(d.ticketUrl)}" style="display:inline-block;background:${C.gold};color:${C.night};text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:2px;">Ticket online öffnen</a>
      </td></tr>
      ${
        d.invoiceUrl
          ? `<tr><td align="center" style="padding:8px 32px 0;"><a href="${escapeHtml(d.invoiceUrl)}" style="color:${C.champagne};font-size:14px;">Rechnung ansehen</a></td></tr>`
          : ''
      }
      <tr><td style="padding:28px 32px 28px;color:${C.muted};font-size:12px;line-height:1.6;border-top:1px solid #3A3026;">
        <p style="margin:16px 0 4px;">Fragen? Schreib uns an <a href="mailto:${escapeHtml(d.contactEmail)}" style="color:${C.champagne};">${escapeHtml(d.contactEmail)}</a>.</p>
        <p style="margin:0 0 4px;">Eine Aktion der Händler – Werbegemeinschaft Detmold e. V.</p>
        <p style="margin:0 0 4px;">${escapeHtml(legalLine())}</p>
        <p style="margin:12px 0 0;">Powered by <a href="https://www.studio-f.club" style="color:${C.muted};">STUDIO/F</a></p>
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
    '',
    'Was dich erwartet:',
    `- ${d.talerCount} Residenztaler beim Einlass (je 1 €, pro gekauftem Artikel 1 Taler)`,
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
