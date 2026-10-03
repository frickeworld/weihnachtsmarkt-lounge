// send-ticket: Ticket-Mail mit QR-Code und PDF über Brevo. Aufruf durch den Stripe-Webhook
// (und ab Phase 5 durch „Ticket erneut senden“ im Admin). Nur mit service_role-Schlüssel.
import { adminClient } from '../_shared/db.ts';
import { json, preflight, requireEnv, safeEqual } from '../_shared/http.ts';
import { deliverTicket } from '../_shared/ticket.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(token, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const { booking_id } = (await req.json().catch(() => ({}))) as { booking_id?: string };
  if (!booking_id) return json({ error: 'booking_id fehlt' }, 400);

  const result = await deliverTicket(adminClient(), booking_id, 'ticket');
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : result.error === 'not_paid' ? 409 : 502;
    return json(result, status);
  }
  return json(result);
});
