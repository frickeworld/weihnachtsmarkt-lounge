// instagram-sync: holt die Follower-Zahl von @diehaendlerdetmold über die Instagram Graph API
// und speichert sie in settings. Aufruf alle 6 Stunden durch pg_cron (Header x-cron-secret).
// Ohne INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN passiert nichts (Zahl wird im Admin gepflegt).
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

  const userId = Deno.env.get('INSTAGRAM_USER_ID');
  const token = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');
  if (!userId || !token) return json({ ok: true, skipped: 'not_configured' });

  const base = (Deno.env.get('INSTAGRAM_API_BASE') ?? 'https://graph.facebook.com/v21.0').replace(
    /\/$/,
    '',
  );
  const res = await fetch(
    `${base}/${encodeURIComponent(userId)}?fields=followers_count&access_token=${encodeURIComponent(token)}`,
  );
  const body = (await res.json().catch(() => ({}))) as { followers_count?: unknown };
  const followers = body.followers_count;
  if (!res.ok || typeof followers !== 'number' || !Number.isInteger(followers) || followers < 0) {
    console.error('instagram', res.status, JSON.stringify(body).slice(0, 300));
    return json({ ok: false, error: 'instagram_failed' }, 502);
  }

  const { error } = await adminClient()
    .from('settings')
    .update({
      instagram_followers: followers,
      instagram_followers_updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    console.error('save', error);
    return json({ ok: false, error: 'save_failed' }, 500);
  }
  return json({ ok: true, followers });
});
