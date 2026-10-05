// send-waitlist: Benachrichtigt die Warteliste, sobald am Wunschtag ein Zeitfenster frei ist.
// Aufruf alle 10 Minuten durch pg_cron (Header x-cron-secret). Jeder Eintrag bekommt genau eine
// Mail und wird danach gelöscht.
import { sendTransactionalEmail } from '../_shared/brevo.ts';
import { adminClient } from '../_shared/db.ts';
import { json, preflight, requireEnv, safeEqual } from '../_shared/http.ts';
import { renderWaitlistEmail } from '../_shared/waitlistEmail.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const cronSecret = req.headers.get('x-cron-secret') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const authorized =
    (cronSecret && safeEqual(cronSecret, requireEnv('CRON_SECRET'))) ||
    safeEqual(bearer, requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
  if (!authorized) return json({ error: 'unauthorized' }, 401);

  const db = adminClient();
  const { data: claimed, error } = await db.rpc('claim_waitlist_notifications', { p_limit: 100 });
  if (error) {
    console.error('claim_waitlist_notifications', error);
    return json({ error: 'claim_failed' }, 500);
  }
  const entries = (claimed ?? []) as { id: string; date: string; email: string }[];
  if (!entries.length) return json({ sent: 0, failed: 0 });

  const site = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  const { data: s } = await db
    .from('settings')
    .select('contact_email')
    .eq('id', 1)
    .single<{ contact_email: string }>();

  // Freie Zeitfenster je Tag einmal laden
  const freeByDate = new Map<
    string,
    { startTime: string; endTime: string; totalCents: number }[]
  >();
  for (const date of new Set(entries.map((e) => e.date))) {
    const { data } = await db.rpc('get_availability_priced', { from_date: date, to_date: date });
    freeByDate.set(
      date,
      (
        (data ?? []) as {
          start_time: string;
          end_time: string;
          status: string;
          total_cents: number;
        }[]
      )
        .filter((r) => r.status === 'free')
        .map((r) => ({
          startTime: r.start_time.slice(0, 5),
          endTime: r.end_time.slice(0, 5),
          totalCents: r.total_cents,
        })),
    );
  }

  let sent = 0;
  let failed = 0;
  for (const e of entries) {
    const slots = freeByDate.get(e.date) ?? [];
    if (!slots.length) {
      // Inzwischen wieder vergeben – beim nächsten Mal erneut prüfen.
      await db.from('waitlist').update({ claimed_at: null }).eq('id', e.id);
      continue;
    }
    const mail = renderWaitlistEmail({
      date: e.date,
      slots,
      bookUrl: `${site}/?datum=${e.date}#buchen`,
      contactEmail: s?.contact_email ?? 'info@studio-f.club',
    });
    try {
      await sendTransactionalEmail({
        to: { email: e.email },
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        tags: ['lounge-warteliste'],
      });
      await db.from('waitlist').delete().eq('id', e.id);
      sent++;
    } catch (err) {
      console.error('waitlist mail', err);
      await db.from('waitlist').update({ claimed_at: null }).eq('id', e.id);
      failed++;
    }
  }
  return json({ sent, failed });
});
