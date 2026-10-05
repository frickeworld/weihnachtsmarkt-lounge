// contact: Kontaktformular „Fragen an STUDIO/F“ und Firmen-/Gruppenanfrage (kind = 'gruppe')
// → Mail an settings.contact_email (Reply-To = Gast).
// Nichts wird gespeichert. Schutz: Honigtopf-Feld und max. 5 Nachrichten je Stunde und Gerät.
import { sendTransactionalEmail } from '../_shared/brevo.ts';
import { renderContactEmail, renderGroupRequestEmail } from '../_shared/contactEmail.ts';
import { contactSchema } from '../_shared/contactSchema.ts';
import { adminClient } from '../_shared/db.ts';
import { groupRequestSchema } from '../_shared/groupRequestSchema.ts';
import { hashClientIp, json, preflight } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const body = await req.json().catch(() => null);
  const isGroup = (body as { kind?: unknown } | null)?.kind === 'gruppe';
  const parsed = isGroup ? groupRequestSchema.safeParse(body) : contactSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return json({ ok: false, message: 'Bitte prüfe die markierten Felder.', fields }, 400);
  }
  const v = parsed.data;
  // Bots füllen das unsichtbare Feld aus – freundlich „ok“ melden, aber nichts senden.
  if (v.website) return json({ ok: true });

  const db = adminClient();
  const { data: allowed } = await db.rpc('register_checkout_attempt', {
    p_ip_hash: `contact:${await hashClientIp(req)}`,
    max_attempts: 5,
  });
  if (allowed === false) {
    return json(
      {
        ok: false,
        message:
          'Du hast uns gerade schon mehrere Nachrichten geschickt. Bitte versuch es später noch einmal.',
      },
      429,
    );
  }

  const { data: s } = await db
    .from('settings')
    .select('contact_email')
    .eq('id', 1)
    .single<{ contact_email: string }>();
  const to = s?.contact_email ?? 'info@studio-f.club';
  const mail =
    'kind' in v && v.kind === 'gruppe'
      ? renderGroupRequestEmail(v, new Date())
      : renderContactEmail(v as Exclude<typeof v, { kind: 'gruppe' }>, new Date());
  try {
    await sendTransactionalEmail({
      to: { email: to, name: 'STUDIO/F' },
      replyTo: { email: v.email, name: v.name },
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      tags: [isGroup ? 'lounge-firmenanfrage' : 'lounge-kontakt'],
    });
  } catch (e) {
    console.error('contact', e);
    return json(
      {
        ok: false,
        message: `Die Nachricht konnte gerade nicht gesendet werden. Schreib uns gern direkt an ${to}.`,
      },
      502,
    );
  }
  return json({ ok: true });
});
