// Tagesbericht für Studio F: gestern, heute in der Lounge, freie Termine der nächsten 7 Tage.
import { escapeHtml } from './emailTemplates.ts';
import { formatLongDate } from './format.ts';

export interface DailyReport {
  day: string;
  yesterday_count: number;
  yesterday_cents: number;
  today: {
    start_time: string;
    end_time: string;
    name: string;
    company: string | null;
    persons: number;
    occasion: string | null;
    notes: string | null;
    booking_code: string;
  }[];
  free_next_7: number;
  offered_next_7: number;
  waitlist: number;
}

const OCCASION: Record<string, string> = {
  firmenfeier: 'Firmenfeier',
  familienfeier: 'Familienfeier',
  freunde: 'Freunde',
  sonstiges: 'Sonstiges',
};
const euro = (c: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(c / 100);

export function renderDailyReportEmail(
  r: DailyReport,
  adminUrl: string,
): { subject: string; html: string; text: string } {
  const day = formatLongDate(r.day);
  const subject = `Lounge heute: ${r.today.length} ${r.today.length === 1 ? 'Buchung' : 'Buchungen'} · gestern ${r.yesterday_count} neu – ${day}`;
  const rows = r.today
    .map(
      (b) =>
        `<tr><td style="padding:8px 10px 8px 0;font-weight:bold;white-space:nowrap;vertical-align:top;">${b.start_time}–${b.end_time}</td><td style="padding:8px 0;vertical-align:top;">${escapeHtml(b.name)}${b.company ? ` (${escapeHtml(b.company)})` : ''} · ${b.persons} Pers.${b.occasion ? ` · ${escapeHtml(OCCASION[b.occasion] ?? b.occasion)}` : ''}<br><span style="color:#5F574B;font-size:13px;">${escapeHtml(b.booking_code)}${b.notes ? ` · Wunsch: ${escapeHtml(b.notes)}` : ''}</span></td></tr>`,
    )
    .join('');
  const kpi = (label: string, value: string) =>
    `<td style="padding:12px;background:#F3EBDC;border-radius:10px;text-align:center;"><div style="font-size:22px;font-weight:bold;">${value}</div><div style="font-size:12px;color:#5F574B;">${label}</div></td>`;
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#FBF7EF;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#23201B;">
<div style="max-width:620px;margin:0 auto;background:#FFFFFF;border:1px solid #E4D8C2;border-radius:14px;padding:24px;">
<p style="margin:0 0 4px;color:#7A5A1E;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Tagesbericht Weihnachtsmarkt-Lounge</p>
<h1 style="margin:0 0 18px;font-size:22px;font-weight:normal;">${escapeHtml(day)}</h1>
<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px 20px;"><tr>
${kpi('Neue Buchungen gestern', String(r.yesterday_count))}
${kpi('Umsatz gestern', euro(r.yesterday_cents))}
${kpi('Frei in 7 Tagen', `${r.free_next_7} von ${r.offered_next_7}`)}
${kpi('Warteliste', String(r.waitlist))}
</tr></table>
<h2 style="margin:0 0 6px;font-size:16px;">Heute in der Lounge</h2>
${r.today.length ? `<table role="presentation" style="border-collapse:collapse;width:100%;">${rows}</table>` : '<p style="color:#5F574B;">Heute ist keine Lounge gebucht.</p>'}
<p style="margin:22px 0 0;"><a href="${escapeHtml(adminUrl)}" style="color:#7A5A1E;font-weight:bold;">Zum Admin-Bereich</a></p>
</div></body></html>`;
  const text = [
    `Tagesbericht Weihnachtsmarkt-Lounge – ${day}`,
    '',
    `Neue Buchungen gestern: ${r.yesterday_count} (${euro(r.yesterday_cents)})`,
    `Frei in den nächsten 7 Tagen: ${r.free_next_7} von ${r.offered_next_7}`,
    `Warteliste: ${r.waitlist}`,
    '',
    'Heute in der Lounge:',
    ...(r.today.length
      ? r.today.map(
          (b) =>
            `- ${b.start_time}–${b.end_time}: ${b.name}${b.company ? ` (${b.company})` : ''}, ${b.persons} Pers.${b.notes ? `, Wunsch: ${b.notes}` : ''} [${b.booking_code}]`,
        )
      : ['- keine Buchung']),
    '',
    `Admin: ${adminUrl}`,
  ].join('\n');
  return { subject, html, text };
}
