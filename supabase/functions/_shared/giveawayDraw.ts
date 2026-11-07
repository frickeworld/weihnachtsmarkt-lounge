// Gewinnspiel-Ziehung: von Hand im Admin (Edge Function `admin`) oder automatisch sonntags
// 18:00 Uhr (Edge Function `giveaway-draw`, aufgerufen von pg_cron). Die Datenbank wählt per
// gewichtetem Zufall; danach gehen die Mails raus: Gewinner bekommt den 100-%-Code, alle anderen
// einen 25-%-Code, der 48 Stunden einlösbar ist.
import { sendTransactionalEmail } from './brevo.ts';
import type { adminClient } from './db.ts';
import { requireEnv } from './http.ts';
import { renderGiveawayConsolation, renderGiveawayWin } from './giveawayEmails.ts';

type Db = ReturnType<typeof adminClient>;

interface DrawRow {
  draw_id: number;
  role: 'gewinn' | 'trostpreis';
  entry_id: string;
  email: string;
  first_name: string;
  code: string;
  code_used: boolean;
  unsubscribe_token: string;
}

export type DrawResult =
  | {
      ok: true;
      drawId: number;
      winner: { firstName: string; email: string };
      participants: number;
      mailsSent: number;
    }
  | { ok: false; status: number; reason: 'empty' | 'already_drawn' | 'failed'; message: string };

/** adminId = null: automatische Ziehung (höchstens einmal in 12 Stunden). */
export async function runGiveawayDraw(db: Db, adminId: string | null): Promise<DrawResult> {
  const { data, error } = await db.rpc('giveaway_draw', { p_admin: adminId });
  if (error) {
    if (error.code === 'P0002')
      return {
        ok: false,
        status: 409,
        reason: 'empty',
        message: 'Im Lostopf ist noch niemand (bestätigte Teilnahme).',
      };
    if (error.code === 'P0003')
      return {
        ok: false,
        status: 409,
        reason: 'already_drawn',
        message: 'Heute wurde schon gezogen.',
      };
    console.error('giveaway_draw', error);
    return { ok: false, status: 500, reason: 'failed', message: 'Die Ziehung ist fehlgeschlagen.' };
  }
  const rows = (data ?? []) as DrawRow[];
  const winner = rows.find((r) => r.role === 'gewinn');
  if (!winner)
    return { ok: false, status: 500, reason: 'failed', message: 'Die Ziehung ist fehlgeschlagen.' };

  const [{ data: s }, { data: nextDraw }, { data: codes }] = await Promise.all([
    db
      .from('settings')
      .select('season_end, giveaway_discount_percent, giveaway_code_hours')
      .eq('id', 1)
      .single<{
        season_end: string;
        giveaway_discount_percent: number;
        giveaway_code_hours: number;
      }>(),
    db.rpc('next_giveaway_draw'),
    db
      .from('discount_codes')
      .select('code, redeem_by')
      .in(
        'code',
        rows.map((r) => r.code),
      ),
  ]);
  const redeemByOf = new Map(
    ((codes ?? []) as { code: string; redeem_by: string | null }[]).map((c) => [
      c.code,
      c.redeem_by,
    ]),
  );
  const fallbackRedeemBy = new Date(
    Date.now() + (s?.giveaway_code_hours ?? 48) * 3600_000,
  ).toISOString();
  const site = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  const validUntil = s?.season_end ?? '';

  let sent = 0;
  for (const r of rows) {
    const unsubscribeUrl = `${site}/gewinnspiel/abmelden?token=${r.unsubscribe_token}`;
    const bookUrl = `${site}/?code=${encodeURIComponent(r.code)}#buchen`;
    const mail =
      r.role === 'gewinn'
        ? renderGiveawayWin({
            firstName: r.first_name,
            code: r.code,
            validUntil,
            bookUrl,
            unsubscribeUrl,
          })
        : renderGiveawayConsolation({
            firstName: r.first_name,
            code: r.code_used ? null : r.code,
            percent: s?.giveaway_discount_percent ?? 10,
            redeemBy: redeemByOf.get(r.code) ?? fallbackRedeemBy,
            nextDraw: typeof nextDraw === 'string' ? nextDraw : null,
            bookUrl,
            unsubscribeUrl,
          });
    try {
      await sendTransactionalEmail({
        to: { email: r.email },
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        tags: [r.role === 'gewinn' ? 'gewinnspiel-gewinn' : 'gewinnspiel-trostpreis'],
      });
      sent++;
    } catch (e) {
      console.error('giveaway mail', r.email, e);
    }
  }
  await db.from('giveaway_draws').update({ mails_sent: sent }).eq('id', winner.draw_id);
  return {
    ok: true,
    drawId: winner.draw_id,
    winner: { firstName: winner.first_name, email: winner.email },
    participants: rows.length,
    mailsSent: sent,
  };
}
