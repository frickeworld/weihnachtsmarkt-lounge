// waitlist: Eintrag auf die Warteliste für einen ausgebuchten Tag (nur E-Mail + Tag).
// Schutz: Honigtopf-Feld und max. 5 Einträge je Stunde und Gerät.
import { adminClient } from '../_shared/db.ts';
import { hashClientIp, json, preflight } from '../_shared/http.ts';
import { waitlistSchema } from '../_shared/waitlistSchema.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const parsed = waitlistSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return json({ ok: false, message: 'Bitte prüfe die markierten Felder.', fields }, 400);
  }
  const v = parsed.data;
  if (v.website) return json({ ok: true });

  const db = adminClient();
  const { data: slots, error: availError } = await db.rpc('get_availability', {
    from_date: v.date,
    to_date: v.date,
  });
  if (availError) {
    console.error('availability', availError);
    return json({ ok: false, message: 'Gerade ist ein Fehler aufgetreten.' }, 500);
  }
  const list = (slots ?? []) as { status: string }[];
  if (list.some((s) => s.status === 'free'))
    return json(
      { ok: false, freeNow: true, message: 'An diesem Tag ist gerade etwas frei – buch direkt.' },
      409,
    );
  if (!list.some((s) => s.status === 'taken'))
    return json({ ok: false, message: 'Für diesen Tag gibt es keine Warteliste.' }, 422);

  const { data: allowed } = await db.rpc('register_checkout_attempt', {
    p_ip_hash: `waitlist:${await hashClientIp(req)}`,
    max_attempts: 5,
  });
  if (allowed === false)
    return json(
      { ok: false, message: 'Zu viele Einträge in kurzer Zeit. Bitte versuch es später.' },
      429,
    );

  const { error } = await db
    .from('waitlist')
    .upsert({ date: v.date, email: v.email }, { onConflict: 'date,email', ignoreDuplicates: true });
  if (error) {
    console.error('waitlist', error);
    return json({ ok: false, message: 'Gerade ist ein Fehler aufgetreten.' }, 500);
  }
  return json({ ok: true });
});
