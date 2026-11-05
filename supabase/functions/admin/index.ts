// admin: Aktionen, die den service_role-Schlüssel brauchen – für studio_admin mit 2FA.
//   resend_ticket   Ticket erneut senden (optional an eine andere E-Mail-Adresse)
//   manual_booking  kostenlose Buchung nach Absprache – auch für Händler (ohne Übergehen von
//                   Buchungsschluss, Sperre, Schließtag oder Saison)
//   cancel_booking  Stornieren, optional mit Erstattung über Stripe (alles / ohne Gebühr / keine)
//   invite_user     Zugang per Einladung (Rolle studio_admin oder haendler)
//   giveaway_draw   Gewinnspiel: Gewinner ziehen, Gewinn- und Trostpreis-Mails senden
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createManualBookingRequestSchema } from '../_shared/bookingSchema.ts';
import { adminClient } from '../_shared/db.ts';
import { json, preflight, requireEnv } from '../_shared/http.ts';
import { deliverTicket } from '../_shared/ticket.ts';
import { runGiveawayDraw } from '../_shared/giveawayDraw.ts';
import { stripeClient } from '../_shared/stripe.ts';

const STATUS_TEXT: Record<string, string> = {
  past: 'Der Buchungsschluss für dieses Zeitfenster ist vorbei.',
  blocked: 'Dieses Zeitfenster ist gesperrt.',
  closed: 'An diesem Tag ist die Lounge geschlossen.',
  out_of_season: 'Der Tag liegt außerhalb der Saison.',
};

/** Prüft Rolle und 2FA über die Datenbank (PostgREST verifiziert das JWT). */
async function authorize(
  req: Request,
  allowHaendler: boolean,
): Promise<{ userId: string; isAdmin: boolean } | Response> {
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: user }, { data: isAdmin }] = await Promise.all([
    userClient.auth.getUser(authorization.slice(7)),
    userClient.rpc('is_admin_aal2'),
  ]);
  if (!user?.user) return json({ error: 'unauthorized' }, 401);
  if (isAdmin === true) return { userId: user.user.id, isAdmin: true };
  if (allowHaendler) {
    // Händler (mit 2FA, falls eingerichtet) – gleiche Regel wie in der Datenbank
    const { data: isHaendler } = await userClient.rpc('is_haendler_or_admin');
    if (isHaendler === true) return { userId: user.user.id, isAdmin: false };
  }
  return json({ error: 'forbidden', message: 'Nur für Admins mit Zwei-Faktor-Anmeldung.' }, 403);
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const body = (await req.json().catch(() => ({}))) as { action?: string } & Record<
    string,
    unknown
  >;
  const auth = await authorize(req, body.action === 'manual_booking');
  if (auth instanceof Response) return auth;
  const db = adminClient();

  switch (body.action) {
    case 'resend_ticket': {
      const id = String(body.booking_id ?? '');
      // Optional an eine andere Person (Ticket ist übertragbar); die Buchung bleibt unverändert.
      const toEmail = String(body.to_email ?? '')
        .trim()
        .toLowerCase();
      const toName = String(body.to_name ?? '')
        .trim()
        .slice(0, 120);
      if (toEmail && !z.string().email().safeParse(toEmail).success)
        return json({ ok: false, message: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);
      const r = await deliverTicket(
        db,
        id,
        'ticket',
        toEmail ? { email: toEmail, name: toName || undefined } : undefined,
      );
      if (r.ok) return json({ ok: true });
      const message =
        r.error === 'not_paid'
          ? 'Nur für bezahlte Buchungen.'
          : r.error === 'not_found'
            ? 'Buchung nicht gefunden.'
            : 'Das Ticket konnte nicht verschickt werden. Details stehen im E-Mail-Verlauf.';
      return json({ ok: false, message }, r.error === 'send_failed' ? 502 : 400);
    }

    case 'manual_booking':
      return manualBooking(db, body, auth.userId, auth.isAdmin);

    case 'cancel_booking':
      return cancelBooking(db, body);

    case 'invite_user':
      return inviteUser(db, body);

    case 'giveaway_draw':
      return giveawayDraw(db, auth.userId);

    default:
      return json({ error: 'unknown_action' }, 400);
  }
});

async function manualBooking(
  db: ReturnType<typeof adminClient>,
  body: Record<string, unknown>,
  userId: string,
  isAdmin: boolean,
): Promise<Response> {
  const { data: settings } = await db
    .from('settings')
    .select('max_persons')
    .eq('id', 1)
    .single<{ max_persons: number }>();
  const parsed = createManualBookingRequestSchema(settings?.max_persons ?? 10).safeParse({
    ...body,
    form: { ...(body.form as object), termsAccepted: true },
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.')] ??= issue.message;
    return json({ ok: false, message: 'Bitte prüfe die Angaben.', fields }, 400);
  }
  const { date, startTime, form, paymentMethod, approvalNote } = parsed.data;
  // Nur Admins dürfen Buchungsschluss, Sperre, Schließtag oder Saison übergehen.
  const override = isAdmin && parsed.data.override;

  const { data: slots, error: availError } = await db.rpc('get_availability', {
    from_date: date,
    to_date: date,
  });
  if (availError)
    return json({ ok: false, message: 'Verfügbarkeit konnte nicht geprüft werden.' }, 500);
  const slot = (slots as { start_time: string; end_time: string; status: string }[]).find(
    (s) => s.start_time.slice(0, 5) === startTime,
  );
  if (!slot)
    return json({ ok: false, message: 'Dieses Zeitfenster gibt es an diesem Tag nicht.' }, 422);
  // get_availability meldet für vergangene/geschlossene Tage nicht „taken“ – darum direkt prüfen.
  const { count: existing } = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('date', date)
    .eq('start_time', slot.start_time)
    .in('status', ['pending', 'paid']);
  if (slot.status === 'taken' || (existing ?? 0) > 0) {
    return json(
      { ok: false, message: 'Dieses Zeitfenster ist bereits gebucht oder reserviert.' },
      409,
    );
  }
  if (slot.status !== 'free' && !isAdmin) {
    return json({ ok: false, message: STATUS_TEXT[slot.status] ?? 'Nicht frei.' }, 409);
  }
  if (slot.status !== 'free' && !override) {
    return json(
      {
        ok: false,
        needsOverride: true,
        message: `${STATUS_TEXT[slot.status] ?? 'Nicht frei.'} Trotzdem buchen?`,
      },
      409,
    );
  }

  const { data: booking, error } = await db
    .from('bookings')
    .insert({
      date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: 'paid',
      source: 'manual',
      payment_method: paymentMethod,
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      persons: form.persons,
      occasion: form.occasion ?? null,
      company_name: form.companyName || null,
      invoice_requested: false,
      notes: form.notes || null,
      approval_note: approvalNote,
      newsletter_opt_in: false,
      paid_at: new Date().toISOString(),
      // Kostenlos: Betrag 0 €, zählt nicht zur Händler-Abrechnung
      include_in_settlement: false,
      amount_total_cents: 0,
      admin_override: slot.status !== 'free',
      created_by: userId,
    })
    .select('id, booking_code')
    .single<{ id: string; booking_code: string }>();

  if (error || !booking) {
    if (error?.code === '23505') {
      return json({ ok: false, message: 'Dieses Zeitfenster wurde gerade gebucht.' }, 409);
    }
    console.error('manual_booking', error);
    return json({ ok: false, message: 'Die Buchung konnte nicht gespeichert werden.' }, 500);
  }

  const ticket = await deliverTicket(db, booking.id, 'ticket');
  return json({
    ok: true,
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    ticketSent: ticket.ok,
  });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Bitte prüfe die E-Mail-Adresse.')),
  role: z.enum(['studio_admin', 'haendler']),
});

async function inviteUser(
  db: ReturnType<typeof adminClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success)
    return json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Ungültig.' }, 400);
  const { email, role } = parsed.data;
  const site = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');

  let userId: string | null = null;
  let invited = false;
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/login/neues-passwort`,
  });
  if (data?.user) {
    userId = data.user.id;
    invited = true;
  } else {
    // Gibt es den Nutzer schon, bekommt er nur die Rolle.
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list } = await db.auth.admin.listUsers({ page, perPage: 200 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (!list || list.users.length < 200) break;
    }
    if (!userId) {
      console.error('invite', error);
      return json({ ok: false, message: 'Die Einladung konnte nicht verschickt werden.' }, 502);
    }
  }

  await db.from('user_roles').delete().eq('user_id', userId);
  const { error: roleError } = await db.from('user_roles').insert({ user_id: userId, role });
  if (roleError)
    return json({ ok: false, message: 'Die Rolle konnte nicht gespeichert werden.' }, 500);
  return json({ ok: true, invited, userId });
}

/** Ziehung von Hand: gleiche Logik wie die automatische Ziehung am Sonntag. */
async function giveawayDraw(db: ReturnType<typeof adminClient>, userId: string): Promise<Response> {
  const r = await runGiveawayDraw(db, userId);
  if (!r.ok) return json({ ok: false, message: r.message }, r.status);
  return json(r);
}

const cancelSchema = z.object({
  booking_id: z.string().uuid('Buchung nicht gefunden.'),
  reason: z.string().trim().min(1, 'Bitte gib einen Grund für die Stornierung an.').max(500),
  refund: z.enum(['full', 'without_fee', 'none']),
});

/**
 * Storno mit optionaler Erstattung. Reihenfolge: erst Stripe-Erstattung, dann Status – schlägt die
 * Erstattung fehl, bleibt die Buchung unverändert. Der Idempotency-Key verhindert doppelte
 * Erstattungen bei einem erneuten Klick.
 */
async function cancelBooking(
  db: ReturnType<typeof adminClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Ungültige Angaben.' },
      400,
    );
  }
  const { booking_id, reason, refund } = parsed.data;
  const { data: b } = await db
    .from('bookings')
    .select('id, status, payment_method, stripe_payment_intent_id, amount_total_cents, fee_cents')
    .eq('id', booking_id)
    .maybeSingle<{
      id: string;
      status: string;
      payment_method: string;
      stripe_payment_intent_id: string | null;
      amount_total_cents: number;
      fee_cents: number;
    }>();
  if (!b || !['paid', 'pending'].includes(b.status)) {
    return json({ ok: false, message: 'Buchung nicht gefunden oder bereits storniert.' }, 404);
  }

  let refundCents = 0;
  let refundId: string | null = null;
  if (refund !== 'none' && b.status === 'paid') {
    if (b.payment_method !== 'stripe' || !b.stripe_payment_intent_id) {
      return json(
        {
          ok: false,
          message: 'Diese Buchung wurde nicht über Stripe bezahlt – keine Erstattung möglich.',
        },
        422,
      );
    }
    refundCents =
      refund === 'full' ? b.amount_total_cents : Math.max(0, b.amount_total_cents - b.fee_cents);
    if (refundCents > 0) {
      try {
        const r = await stripeClient().refunds.create(
          {
            payment_intent: b.stripe_payment_intent_id,
            amount: refundCents,
            reason: 'requested_by_customer',
            metadata: { booking_id: b.id },
          },
          { idempotencyKey: `refund-${b.id}-${refundCents}` },
        );
        refundId = r.id;
      } catch (e) {
        console.error('refund', e);
        const msg = e instanceof Error ? e.message : '';
        return json(
          {
            ok: false,
            message:
              `Stripe hat die Erstattung abgelehnt. Die Buchung bleibt bestehen. ${msg}`.trim(),
          },
          502,
        );
      }
    }
  }

  const { error } = await db
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
      ...(refundId
        ? {
            refund_cents: refundCents,
            refunded_at: new Date().toISOString(),
            stripe_refund_id: refundId,
          }
        : {}),
    })
    .eq('id', b.id)
    .in('status', ['paid', 'pending']);
  if (error) {
    console.error('cancel_booking', error);
    return json(
      {
        ok: false,
        message: refundId
          ? 'Erstattet, aber die Buchung konnte nicht als storniert gespeichert werden. Bitte Studio F melden.'
          : 'Die Buchung konnte nicht storniert werden.',
      },
      500,
    );
  }
  return json({ ok: true, refundCents });
}
