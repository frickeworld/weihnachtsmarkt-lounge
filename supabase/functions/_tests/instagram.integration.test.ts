// Integrationstest Instagram-Follower: Graph API simuliert, Zahl landet in settings und öffentlich.
import { assertEquals } from 'jsr:@std/assert@1';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const FN = Deno.env.get('FN_INSTAGRAM') ?? 'http://127.0.0.1:8112';
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

Deno.test({
  name: 'instagram-sync: Follower-Zahl holen und veröffentlichen',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    let reply: { status: number; body: unknown } = { status: 200, body: { followers_count: 2345 } };
    const seen: string[] = [];
    const graph = Deno.serve({ hostname: '127.0.0.1', port: 8197, onListen: () => {} }, (req) => {
      seen.push(new URL(req.url).pathname + new URL(req.url).search);
      return Response.json(reply.body, { status: reply.status });
    });
    const { data: original } = await db
      .from('settings')
      .select('instagram_followers, instagram_followers_updated_at')
      .eq('id', 1)
      .single();
    const call = (headers: Record<string, string>) =>
      fetch(FN, { method: 'POST', headers, body: '{}' }).then(async (r) => ({
        status: r.status,
        body: await r.json(),
      }));
    try {
      await t.step('ohne Berechtigung → 401', async () => {
        assertEquals((await call({})).status, 401);
      });
      await t.step('Zahl wird gespeichert und ist öffentlich lesbar', async () => {
        const r = await call({ 'x-cron-secret': Deno.env.get('CRON_SECRET')! });
        assertEquals(r.body, { ok: true, followers: 2345 });
        assertEquals(
          seen[0],
          '/17841400000000000?fields=followers_count&access_token=ig_test_token',
        );
        const { data } = await anon.rpc('get_instagram_stats');
        assertEquals((data as { followers: number }[])[0]!.followers, 2345);
      });
      await t.step('Fehler der API → 502, alte Zahl bleibt', async () => {
        reply = { status: 400, body: { error: { message: 'token expired' } } };
        const r = await call({ 'x-cron-secret': Deno.env.get('CRON_SECRET')! });
        assertEquals(r.status, 502);
        const { data } = await anon.rpc('get_instagram_stats');
        assertEquals((data as { followers: number }[])[0]!.followers, 2345);
      });
    } finally {
      await db.from('settings').update(original!).eq('id', 1);
      await graph.shutdown();
    }
  },
});
