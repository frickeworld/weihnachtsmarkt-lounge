// Einladung in den Admin- oder Händler-Bereich. Versand über Brevo (siehe admin/index.ts).
import { escapeHtml } from './emailTemplates.ts';

const ROLE_TEXT: Record<string, string> = {
  studio_admin: 'den Admin-Bereich',
  haendler: 'den Händler-Bereich',
};

export function renderInviteEmail(d: { link: string; role: string; siteUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const area = ROLE_TEXT[d.role] ?? 'den geschützten Bereich';
  const admin = d.role === 'studio_admin';
  const subject = 'Dein Zugang zur Weihnachtsmarkt-Lounge';
  const link = escapeHtml(d.link);
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#FBF7EF;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#23201B;">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E4D8C2;border-radius:12px;padding:28px;">
<p style="margin:0 0 4px;color:#7A5A1E;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Weihnachtsmarkt-Lounge der Händler</p>
<h1 style="margin:0 0 16px;font-size:22px;">Dein Zugang ist eingerichtet</h1>
<p style="margin:0 0 12px;">Hallo,</p>
<p style="margin:0 0 12px;">du wurdest für ${area} der Weihnachtsmarkt-Lounge freigeschaltet. Leg über den Knopf dein Passwort fest – danach kannst du dich jederzeit anmelden.</p>
${admin ? '<p style="margin:0 0 12px;">Für den Admin-Bereich richtest du bei der ersten Anmeldung zusätzlich die Zwei-Faktor-Anmeldung mit einer Authenticator-App ein (z. B. Google Authenticator oder die Passwörter-App auf dem iPhone).</p>' : ''}
<p style="margin:24px 0;text-align:center;"><a href="${link}" style="display:inline-block;background:#C6A45C;color:#23201B;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;">Passwort festlegen</a></p>
<p style="margin:0 0 12px;color:#5F574B;font-size:13px;">Der Link ist nur kurze Zeit gültig und funktioniert einmal. Ist er abgelaufen, fordere unter ${escapeHtml(d.siteUrl)}/login über „Passwort vergessen“ einen neuen an.</p>
</div></body></html>`;
  const text = [
    'Dein Zugang zur Weihnachtsmarkt-Lounge ist eingerichtet.',
    '',
    `Du wurdest für ${area} freigeschaltet. Leg hier dein Passwort fest:`,
    d.link,
    '',
    ...(admin
      ? [
          'Bei der ersten Anmeldung richtest du die Zwei-Faktor-Anmeldung mit einer Authenticator-App ein.',
          '',
        ]
      : []),
    `Der Link ist nur kurze Zeit gültig. Ist er abgelaufen: ${d.siteUrl}/login → „Passwort vergessen“.`,
  ].join('\n');
  return { subject, html, text };
}
