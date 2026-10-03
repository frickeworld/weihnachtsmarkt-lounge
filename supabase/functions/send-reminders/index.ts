// send-reminders: Erinnerung am Buchungstag ab 10:00 Uhr (Europe/Berlin).
// Aufruf alle 15 Minuten durch pg_cron (Header x-cron-secret). Verschickt jede Erinnerung genau einmal.
import { adminClient } from '../_shared/db.ts';
import { json, preflight, requireEnv, safeEqual } from '../_shared/http.ts';
import { deliverTicket } from '../_shared/ticket.ts';

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
  const { data: ids, error } = await db.rpc('claim_due_reminders', { p_limit: 50 });
  if (error) {
    console.error('claim_due_reminders', error);
    return json({ error: 'claim_failed' }, 500);
  }

  let sent = 0;
  let failed = 0;
  for (const id of (ids as string[]) ?? []) {
    const r = await deliverTicket(db, id, 'reminder');
    if (r.ok) sent++;
    else {
      failed++;
      // Beim nächsten Lauf erneut versuchen.
      await db.rpc('release_reminder_claim', { p_booking_id: id });
    }
  }
  return json({ sent, failed });
});
