// Mails zum Gewinnspiel: Bestätigung (Double-Opt-in), Gewinn, Trostpreis nach jeder Ziehung.
import { escapeHtml } from './emailTemplates.ts';
import { formatLongDate } from './format.ts';

export interface MailParts {
  subject: string;
  html: string;
  text: string;
}

function frame(eyebrow: string, title: string, body: string, footer: string): string {
  return `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#FBF7EF;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#23201B;">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E4D8C2;border-radius:16px;overflow:hidden;">
<div style="height:8px;background:#C6A45C;"></div>
<div style="padding:28px;">
<p style="margin:0 0 6px;color:#7A5A1E;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">${eyebrow}</p>
<h1 style="margin:0 0 16px;font-size:24px;font-weight:normal;line-height:1.3;">${title}</h1>
${body}
</div>
<div style="padding:18px 28px;background:#24221E;color:#F8F3E8;font-size:12px;line-height:1.6;">${footer}</div>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0;text-align:center;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#C6A45C;color:#23201B;text-decoration:none;font-weight:bold;padding:14px 30px;border-radius:999px;">${label}</a></p>`;

const legalFooter = (unsubscribeUrl: string) =>
  `Gewinnspiel der Händler – Werbegemeinschaft Detmold e. V. · Powered by STUDIO/F<br>Du bekommst diese Mail, weil du am Gewinnspiel teilnimmst und dem Newsletter zugestimmt hast. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#F8F3E8;">Abmelden</a>`;

export function renderGiveawayConfirm(d: { firstName: string; confirmUrl: string }): MailParts {
  const subject = 'Bitte bestätige deine Teilnahme am Lounge-Gewinnspiel';
  const html = frame(
    'Gewinnspiel Weihnachtsmarkt-Lounge',
    `Fast geschafft, ${escapeHtml(d.firstName)}!`,
    `<p style="margin:0 0 12px;line-height:1.6;">Bitte bestätige mit einem Klick deine E-Mail-Adresse. Erst dann bist du im Lostopf – für alle wöchentlichen Ziehungen bis zum Ende der Aktion – und bekommst unseren Newsletter.</p>
${button(d.confirmUrl, 'Teilnahme bestätigen')}
<p style="margin:0;color:#5F574B;font-size:13px;line-height:1.6;">Du hast dich nicht angemeldet? Dann ignoriere diese Mail einfach – ohne Bestätigung speichern wir nichts weiter und löschen den Eintrag.</p>`,
    'Gewinnspiel der Händler – Werbegemeinschaft Detmold e. V. · Powered by STUDIO/F',
  );
  const text = [
    `Fast geschafft, ${d.firstName}!`,
    '',
    'Bitte bestätige deine Teilnahme am Lounge-Gewinnspiel (und den Newsletter):',
    d.confirmUrl,
    '',
    'Du hast dich nicht angemeldet? Dann ignoriere diese Mail einfach.',
  ].join('\n');
  return { subject, html, text };
}

export function renderGiveawayWin(d: {
  firstName: string;
  code: string;
  validUntil: string;
  bookUrl: string;
  unsubscribeUrl: string;
}): MailParts {
  const subject = 'Du hast gewonnen: ein Abend in der Weihnachtsmarkt-Lounge';
  const html = frame(
    'Gewinnspiel Weihnachtsmarkt-Lounge',
    `Herzlichen Glückwunsch, ${escapeHtml(d.firstName)}!`,
    `<p style="margin:0 0 12px;line-height:1.6;">Du hast in dieser Woche gewonnen: <strong>einen Abend in der Lounge der Händler</strong> für bis zu 10 Personen – mit Freiverzehr in Residenztalern und Tischservice der Tanzschule Fricke.</p>
<p style="margin:0 0 8px;line-height:1.6;">Such dir einfach einen freien Abend aus und gib bei der Buchung diesen Code ein:</p>
<p style="margin:16px 0;text-align:center;font-family:Courier New,monospace;font-size:24px;font-weight:bold;letter-spacing:3px;background:#F3EBDC;padding:14px;border-radius:10px;">${escapeHtml(d.code)}</p>
<p style="margin:0;color:#5F574B;font-size:13px;line-height:1.6;">Gültig für einen freien Abend bis ${escapeHtml(formatLongDate(d.validUntil))} (nicht für Sonderveranstaltungen). Einmal einlösbar, keine Barauszahlung.</p>
${button(d.bookUrl, 'Jetzt Abend aussuchen')}`,
    legalFooter(d.unsubscribeUrl),
  );
  const text = [
    `Herzlichen Glückwunsch, ${d.firstName}!`,
    '',
    'Du hast einen Abend in der Lounge der Händler gewonnen (bis zu 10 Personen, Freiverzehr, Tischservice).',
    `Dein Code: ${d.code}`,
    `Gültig für einen freien Abend bis ${formatLongDate(d.validUntil)} (nicht für Sonderveranstaltungen).`,
    '',
    `Abend aussuchen: ${d.bookUrl}`,
    '',
    `Abmelden: ${d.unsubscribeUrl}`,
  ].join('\n');
  return { subject, html, text };
}

export function renderGiveawayConsolation(d: {
  firstName: string;
  code: string | null;
  percent: number;
  validUntil: string;
  nextDraw: string | null;
  bookUrl: string;
  unsubscribeUrl: string;
}): MailParts {
  const subject = d.code
    ? `Diesmal nicht – aber ${d.percent} % für deinen Lounge-Abend`
    : 'Diesmal nicht – du bleibst im Lostopf';
  const next = d.nextDraw
    ? `Du bleibst im Lostopf: Die nächste Ziehung ist am ${escapeHtml(formatLongDate(d.nextDraw))}.`
    : 'Danke fürs Mitmachen!';
  const html = frame(
    'Gewinnspiel Weihnachtsmarkt-Lounge',
    `Diesmal hat es nicht geklappt, ${escapeHtml(d.firstName)}`,
    `<p style="margin:0 0 12px;line-height:1.6;">${next}</p>
${
  d.code
    ? `<p style="margin:0 0 8px;line-height:1.6;">Damit du nicht bis dahin warten musst: Mit deinem persönlichen Code sparst du <strong>${d.percent} %</strong> auf einen Abend von Montag bis Donnerstag – der Freiverzehr bleibt voll erhalten.</p>
<p style="margin:16px 0;text-align:center;font-family:Courier New,monospace;font-size:24px;font-weight:bold;letter-spacing:3px;background:#F3EBDC;padding:14px;border-radius:10px;">${escapeHtml(d.code)}</p>
<p style="margin:0;color:#5F574B;font-size:13px;line-height:1.6;">Gültig bis ${escapeHtml(formatLongDate(d.validUntil))}, montags bis donnerstags, einmal einlösbar, nicht für Sonderveranstaltungen.</p>
${button(d.bookUrl, 'Lounge buchen')}`
    : ''
}`,
    legalFooter(d.unsubscribeUrl),
  );
  const text = [
    `Diesmal hat es nicht geklappt, ${d.firstName}.`,
    '',
    d.nextDraw
      ? `Du bleibst im Lostopf: Die nächste Ziehung ist am ${formatLongDate(d.nextDraw)}.`
      : 'Danke fürs Mitmachen!',
    ...(d.code
      ? [
          '',
          `Dein persönlicher Code: ${d.code} – ${d.percent} % auf einen Abend Mo–Do (Freiverzehr bleibt voll).`,
          `Gültig bis ${formatLongDate(d.validUntil)}, einmal einlösbar, nicht für Sonderveranstaltungen.`,
          `Lounge buchen: ${d.bookUrl}`,
        ]
      : []),
    '',
    `Abmelden: ${d.unsubscribeUrl}`,
  ].join('\n');
  return { subject, html, text };
}
