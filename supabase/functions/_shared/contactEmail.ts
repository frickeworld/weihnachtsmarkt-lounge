// Mail an STUDIO/F aus dem Kontaktformular. Antworten gehen per Reply-To direkt an den Gast.
import { CONTACT_TOPICS, type ContactValues } from './contactSchema.ts';
import { escapeHtml } from './emailTemplates.ts';
import type { GroupRequestValues } from './groupRequestSchema.ts';

export function renderContactEmail(
  v: ContactValues,
  receivedAt: Date,
): {
  subject: string;
  html: string;
  text: string;
} {
  const topic = CONTACT_TOPICS.find((t) => t.value === v.topic)?.label ?? v.topic;
  const when = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(receivedAt);
  const subject =
    `Lounge-Anfrage: ${topic}${v.bookingCode ? ` (${v.bookingCode})` : ''} – ${v.name}`.slice(
      0,
      150,
    );
  const row = (k: string, val: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#5F574B;vertical-align:top;">${k}</td><td style="padding:6px 0;color:#23201B;font-weight:bold;">${val}</td></tr>`;
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#FBF7EF;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#23201B;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E4D8C2;border-radius:12px;padding:24px;">
<p style="margin:0 0 4px;color:#7A5A1E;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Weihnachtsmarkt-Lounge · Kontaktformular</p>
<h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(topic)}</h1>
<table style="border-collapse:collapse;margin-bottom:16px;">
${row('Name', escapeHtml(v.name))}
${row('E-Mail', `<a href="mailto:${escapeHtml(v.email)}" style="color:#7A5A1E;">${escapeHtml(v.email)}</a>`)}
${v.bookingCode ? row('Buchungscode', escapeHtml(v.bookingCode)) : ''}
${row('Eingegangen', escapeHtml(when))}
</table>
<div style="white-space:pre-wrap;border-top:1px solid #E4D8C2;padding-top:16px;line-height:1.6;">${escapeHtml(v.message)}</div>
<p style="margin:24px 0 0;color:#5F574B;font-size:12px;">Einfach auf diese Mail antworten – die Antwort geht direkt an ${escapeHtml(v.email)}.</p>
</div></body></html>`;
  const text = [
    `Kontaktformular Weihnachtsmarkt-Lounge – ${topic}`,
    '',
    `Name: ${v.name}`,
    `E-Mail: ${v.email}`,
    ...(v.bookingCode ? [`Buchungscode: ${v.bookingCode}`] : []),
    `Eingegangen: ${when}`,
    '',
    v.message,
    '',
    `Einfach antworten – die Antwort geht an ${v.email}.`,
  ].join('\n');
  return { subject, html, text };
}

/** Mail an STUDIO/F für eine Firmen- bzw. Gruppenanfrage. */
export function renderGroupRequestEmail(
  v: GroupRequestValues,
  receivedAt: Date,
): { subject: string; html: string; text: string } {
  const when = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(receivedAt);
  const subject =
    `Firmenanfrage: ${v.company} – ${v.slots} Zeitfenster, ${v.persons} Personen`.slice(0, 150);
  const row = (k: string, val: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#5F574B;vertical-align:top;">${k}</td><td style="padding:6px 0;color:#23201B;font-weight:bold;">${val}</td></tr>`;
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#FBF7EF;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#23201B;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E4D8C2;border-radius:12px;padding:24px;">
<p style="margin:0 0 4px;color:#7A5A1E;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Weihnachtsmarkt-Lounge · Firmen &amp; Gruppen</p>
<h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(v.company)}</h1>
<table style="border-collapse:collapse;margin-bottom:16px;">
${row('Ansprechperson', escapeHtml(v.name))}
${row('E-Mail', `<a href="mailto:${escapeHtml(v.email)}" style="color:#7A5A1E;">${escapeHtml(v.email)}</a>`)}
${v.phone ? row('Telefon', escapeHtml(v.phone)) : ''}
${row('Zeitfenster', String(v.slots))}
${row('Personen gesamt', String(v.persons))}
${row('Wunschtermine', escapeHtml(v.dates))}
${row('Eingegangen', escapeHtml(when))}
</table>
${v.message ? `<div style="white-space:pre-wrap;border-top:1px solid #E4D8C2;padding-top:16px;line-height:1.6;">${escapeHtml(v.message)}</div>` : ''}
<p style="margin:24px 0 0;color:#5F574B;font-size:12px;">Einfach auf diese Mail antworten – die Antwort geht direkt an ${escapeHtml(v.email)}. Termine im Admin unter „Neue Buchung“ anlegen.</p>
</div></body></html>`;
  const text = [
    `Firmenanfrage Weihnachtsmarkt-Lounge – ${v.company}`,
    '',
    `Ansprechperson: ${v.name}`,
    `E-Mail: ${v.email}`,
    ...(v.phone ? [`Telefon: ${v.phone}`] : []),
    `Zeitfenster: ${v.slots}`,
    `Personen gesamt: ${v.persons}`,
    `Wunschtermine: ${v.dates}`,
    `Eingegangen: ${when}`,
    ...(v.message ? ['', v.message] : []),
    '',
    `Einfach antworten – die Antwort geht an ${v.email}.`,
  ].join('\n');
  return { subject, html, text };
}
