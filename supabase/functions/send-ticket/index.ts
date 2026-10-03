// send-ticket: Versand von QR-Code, PDF-Ticket und Brevo-Kontakt folgt in Phase 4.
// Phase 3: Stub, der nur mit dem service_role-Schlüssel aufrufbar ist.
import { json, preflight, requireEnv, safeEqual } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(token, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const { booking_id } = (await req.json().catch(() => ({}))) as { booking_id?: string };
  console.log('send-ticket (Stub, Phase 4) für Buchung', booking_id);
  return json({ queued: true, stub: true }, 202);
});
