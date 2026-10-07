// giveaway: Gewinnspiel „Jede Woche einen Abend gewinnen“ (öffentlich).
//   POST { action: 'join', ...form }        Teilnahme → Bestätigungsmail (Double-Opt-in)
//   POST { action: 'confirm', token }        Bestätigen → Lostopf + Newsletter-Liste in Brevo
//   POST { action: 'unsubscribe', token }    Abmelden (keine Ziehungen und Mails mehr)
// Schutz: Honigtopf, max. 5 Anmeldungen je Stunde und Gerät. Doppelte Adressen bekommen keinen Hinweis.
import {
  contactAttributes,
  sendTransactionalEmail,
  upsertNewsletterContact,
} from '../_shared/brevo.ts';
import { adminClient } from '../_shared/db.ts';
import { renderGiveawayConfirm } from '../_shared/giveawayEmails.ts';
import { GIVEAWAY_CONSENT_VERSION, giveawayJoinSchema } from '../_shared/giveawaySchema.ts';
import { hashClientIp, json, preflight, requireEnv } from '../_shared/http.ts';

const TOKEN = /^[A-Za-z0-9]{32}$/;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const body = (await req.json().catch(() => ({}))) as { action?: string } & Record<
    string,
    unknown
  >;
  const db = adminClient();
  const site = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');

  if (body.action === 'join') {
    const { data: info } = await db.rpc('get_giveaway_info').single<{ active: boolean }>();
    if (!info?.active)
      return json({ ok: false, message: 'Das Gewinnspiel ist gerade nicht aktiv.' }, 409);

    const parsed = giveawayJoinSchema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
      return json({ ok: false, message: 'Bitte prüfe die markierten Felder.', fields }, 400);
    }
    const v = parsed.data;
    if (v.website) return json({ ok: true });

    const { data: allowed } = await db.rpc('register_checkout_attempt', {
      p_ip_hash: `giveaway:${await hashClientIp(req)}`,
      max_attempts: 5,
    });
    if (allowed === false)
      return json(
        { ok: false, message: 'Zu viele Anmeldungen in kurzer Zeit. Bitte versuch es später.' },
        429,
      );

    let referredBy: string | null = null;
    if (v.ref) {
      const { data: ref } = await db
        .from('giveaway_entries')
        .select('id')
        .eq('ref_code', v.ref)
        .maybeSingle<{ id: string }>();
      referredBy = ref?.id ?? null;
    }

    const { data: existing } = await db
      .from('giveaway_entries')
      .select('id, first_name, confirm_token, confirmed_at, unsubscribed_at')
      .eq('email', v.email)
      .maybeSingle<{
        id: string;
        first_name: string;
        confirm_token: string;
        confirmed_at: string | null;
        unsubscribed_at: string | null;
      }>();

    let token: string;
    let firstName = v.firstName;
    if (existing) {
      // Schon bestätigt und aktiv: keine neue Mail, gleiche Antwort (keine Auskunft über Adressen).
      if (existing.confirmed_at && !existing.unsubscribed_at) return json({ ok: true });
      await db
        .from('giveaway_entries')
        .update({
          first_name: v.firstName,
          last_name: v.lastName,
          company: v.company || null,
          consent_version: GIVEAWAY_CONSENT_VERSION,
          unsubscribed_at: null,
          confirmed_at: null,
        })
        .eq('id', existing.id);
      token = existing.confirm_token;
    } else {
      const { data: created, error } = await db
        .from('giveaway_entries')
        .insert({
          email: v.email,
          first_name: v.firstName,
          last_name: v.lastName,
          company: v.company || null,
          referred_by: referredBy,
          consent_version: GIVEAWAY_CONSENT_VERSION,
        })
        .select('confirm_token, first_name')
        .single<{ confirm_token: string; first_name: string }>();
      if (error || !created) {
        console.error('giveaway insert', error);
        return json({ ok: false, message: 'Gerade ist ein Fehler aufgetreten.' }, 500);
      }
      token = created.confirm_token;
      firstName = created.first_name;
    }

    const mail = renderGiveawayConfirm({
      firstName,
      confirmUrl: `${site}/gewinnspiel/bestaetigt?token=${token}`,
    });
    try {
      await sendTransactionalEmail({
        to: { email: v.email, name: `${v.firstName} ${v.lastName}` },
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        tags: ['gewinnspiel-doi'],
      });
    } catch (e) {
      console.error('giveaway mail', e);
      return json(
        { ok: false, message: 'Die Bestätigungsmail konnte gerade nicht gesendet werden.' },
        502,
      );
    }
    return json({ ok: true });
  }

  if (body.action === 'confirm' || body.action === 'unsubscribe') {
    const token = String(body.token ?? '');
    if (!TOKEN.test(token)) return json({ ok: false, message: 'Ungültiger Link.' }, 400);
    const { data: e } = await db
      .from('giveaway_entries')
      .select('id, email, first_name, last_name, company, ref_code, confirmed_at, unsubscribed_at')
      .eq('confirm_token', token)
      .is('anonymized_at', null)
      .maybeSingle<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        company: string | null;
        ref_code: string;
        confirmed_at: string | null;
        unsubscribed_at: string | null;
      }>();
    if (!e) return json({ ok: false, message: 'Dieser Link ist ungültig oder abgelaufen.' }, 404);

    if (body.action === 'unsubscribe') {
      if (!e.unsubscribed_at)
        await db
          .from('giveaway_entries')
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq('id', e.id);
      return json({ ok: true });
    }

    if (!e.confirmed_at || e.unsubscribed_at) {
      await db
        .from('giveaway_entries')
        .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
        .eq('id', e.id);
      // Bestätigte Einwilligung → Newsletter-Liste in Brevo (ohne zweite Bestätigungsmail)
      try {
        await upsertNewsletterContact(
          e.email,
          contactAttributes(e.first_name, e.last_name, e.company),
        );
      } catch (err) {
        console.error('brevo newsletter', err);
      }
    }
    return json({
      ok: true,
      firstName: e.first_name,
      refCode: e.ref_code,
      shareUrl: `${site}/gewinnspiel?ref=${e.ref_code}`,
    });
  }

  return json({ error: 'unknown_action' }, 400);
});
