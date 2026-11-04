// giveaway-draw: automatische Gewinnspiel-Ziehung jeden Sonntag 18:00 Uhr (Europe/Berlin).
// Aufruf nur durch pg_cron (public.invoke_giveaway_draw, Header x-cron-secret) oder mit dem
// Service-Role-Schlüssel. Höchstens eine automatische Ziehung in 12 Stunden.
import { adminClient } from '../_shared/db.ts';
import { runGiveawayDraw } from '../_shared/giveawayDraw.ts';
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

  const r = await runGiveawayDraw(adminClient(), null);
  if (!r.ok) {
    // Leerer Lostopf oder schon gezogen ist kein Fehler – pg_cron soll nicht wiederholen.
    if (r.reason !== 'failed') return json({ ok: true, skipped: r.reason });
    return json({ ok: false, message: r.message }, r.status);
  }
  return json(r);
});
