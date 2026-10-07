// daily-report: Tagesbericht per Mail (7:45 Uhr Berliner Zeit, durch pg_cron).
// Empfänger: settings.contact_email + settings.daily_report_recipients. Jeder Tag einmal.
import { sendTransactionalEmail } from '../_shared/brevo.ts';
import { renderDailyReportEmail, type DailyReport } from '../_shared/dailyReportEmail.ts';
import { adminClient } from '../_shared/db.ts';
import { json, preflight, requireEnv, safeEqual } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const cronSecret = req.headers.get('x-cron-secret') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const authorized =
    (cronSecret && safeEqual(cronSecret, requireEnv('CRON_SECRET'))) ||
    safeEqual(bearer, requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
  if (!authorized) return json({ error: 'unauthorized' }, 401);

  const body = (await req.json().catch(() => ({}))) as { day?: string; force?: boolean };
  const day =
    body.day && /^\d{4}-\d{2}-\d{2}$/.test(body.day)
      ? body.day
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  const db = adminClient();
  const { data, error } = await db.rpc('daily_report_data', { p_day: day });
  if (error || !data) {
    console.error('daily_report_data', error);
    return json({ error: 'data_failed' }, 500);
  }
  const r = data as DailyReport & { in_season: boolean; recipients: string[] };
  if (!r.in_season && !body.force) return json({ ok: true, skipped: 'out_of_season' });

  // Jeder Tag nur einmal (Eintrag zuerst, damit parallele Aufrufe nicht doppelt senden)
  const { error: claimError } = await db.from('daily_reports').insert({ day });
  if (claimError) {
    if (claimError.code === '23505') return json({ ok: true, skipped: 'already_sent' });
    console.error('claim', claimError);
    return json({ error: 'claim_failed' }, 500);
  }

  const site = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  const mail = renderDailyReportEmail(r, `${site}/admin`);
  let sent = 0;
  for (const email of r.recipients) {
    try {
      await sendTransactionalEmail({
        to: { email },
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        tags: ['lounge-tagesbericht'],
      });
      sent++;
    } catch (e) {
      console.error('daily report', email, e);
    }
  }
  if (!sent) await db.from('daily_reports').delete().eq('day', day);
  return json({ ok: sent > 0, sent });
});
