// Benachrichtigung „Es ist wieder ein Zeitfenster frei“ für die Warteliste.
import { escapeHtml } from './emailTemplates.ts';
import { formatLongDate } from './format.ts';

export interface WaitlistMailData {
  date: string;
  slots: { startTime: string; endTime: string; totalCents: number }[];
  bookUrl: string;
  contactEmail: string;
}

const euro = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
    .format(cents / 100)
    .replace(/,00\s?€$/, ' €');

export function renderWaitlistEmail(d: WaitlistMailData): {
  subject: string;
  html: string;
  text: string;
} {
  const day = formatLongDate(d.date);
  const subject = `Wieder frei: Lounge am ${day}`;
  const list = d.slots.map((s) => `${s.startTime}–${s.endTime} Uhr · ${euro(s.totalCents)}`);
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#FBF7EF;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#23201B;">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E4D8C2;border-radius:16px;padding:28px;">
<p style="margin:0 0 6px;color:#7A5A1E;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Weihnachtsmarkt-Lounge der Händler</p>
<h1 style="margin:0 0 14px;font-size:24px;font-weight:normal;">Gute Nachricht: Am ${escapeHtml(day)} ist wieder etwas frei.</h1>
<p style="margin:0 0 12px;line-height:1.6;">Du hattest dich auf die Warteliste gesetzt. Gerade ist an deinem Wunschtag wieder Platz:</p>
<ul style="margin:0 0 18px;padding-left:20px;line-height:1.8;">${list.map((l) => `<li><strong>${escapeHtml(l)}</strong></li>`).join('')}</ul>
<p style="margin:0 0 22px;line-height:1.6;">Wer zuerst bucht, bekommt die Lounge – wir informieren alle auf der Warteliste gleichzeitig.</p>
<p style="margin:0 0 24px;text-align:center;"><a href="${escapeHtml(d.bookUrl)}" style="display:inline-block;background:#C6A45C;color:#23201B;text-decoration:none;font-weight:bold;padding:14px 30px;border-radius:999px;">Lounge buchen</a></p>
<p style="margin:0;color:#5F574B;font-size:13px;line-height:1.6;">Das war unsere einzige Nachricht zu diesem Tag – deine E-Mail-Adresse haben wir von der Warteliste gelöscht. Fragen? ${escapeHtml(d.contactEmail)}</p>
</div></body></html>`;
  const text = [
    `Gute Nachricht: Am ${day} ist wieder etwas frei.`,
    '',
    ...list.map((l) => `- ${l}`),
    '',
    'Wer zuerst bucht, bekommt die Lounge – wir informieren alle auf der Warteliste gleichzeitig.',
    `Lounge buchen: ${d.bookUrl}`,
    '',
    'Das war unsere einzige Nachricht zu diesem Tag – deine E-Mail-Adresse haben wir von der Warteliste gelöscht.',
    `Fragen? ${d.contactEmail}`,
  ].join('\n');
  return { subject, html, text };
}
