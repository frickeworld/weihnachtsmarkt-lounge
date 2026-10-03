// release-hold: Gast bricht bei Stripe ab → Reservierung sofort freigeben.
// Nur möglich, solange die Buchung noch 'pending' und die Stripe-Session nicht bezahlt ist.
import { adminClient } from '../_shared/db.ts';
import { json, preflight } from '../_shared/http.ts';
import { stripeClient } from '../_shared/stripe.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  let bookingId = '';
  try {
    bookingId = String(((await req.json()) as { bookingId?: unknown }).bookingId ?? '');
  } catch {
    // leer
  }
  if (!UUID.test(bookingId)) return json({ released: false }, 400);

  const db = adminClient();
  const { data: booking } = await db
    .from('bookings')
    .select('id, status, stripe_checkout_session_id')
    .eq('id', bookingId)
    .maybeSingle<{ id: string; status: string; stripe_checkout_session_id: string | null }>();

  if (!booking || booking.status !== 'pending') return json({ released: false });

  if (booking.stripe_checkout_session_id) {
    const stripe = stripeClient();
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id);
      if (session.status === 'complete') return json({ released: false });
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
    } catch (e) {
      console.error('release-hold stripe', e);
      return json({ released: false }, 502);
    }
  }

  const { data: released, error } = await db.rpc('mark_booking_expired', {
    p_booking_id: bookingId,
  });
  if (error) {
    console.error('release-hold', error);
    return json({ released: false }, 500);
  }
  return json({ released: Boolean(released) });
});
