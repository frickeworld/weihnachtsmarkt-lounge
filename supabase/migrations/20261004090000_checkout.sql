-- =====================================================================================
-- Phase 3: Checkout mit Stripe
-- Statuswechsel laufen ausschließlich über diese Funktionen. Aufrufbar nur mit dem
-- service_role-Schlüssel (Edge Functions) – nie aus dem Browser.
-- =====================================================================================

-- Schutz vor Massen-Reservierungen: pro (gehashter) IP begrenzte Checkout-Versuche.
-- IP-Adressen werden nur als salted SHA-256-Hash gespeichert und nach 24 Stunden gelöscht.
create table public.checkout_attempts (
  ip_hash text not null,
  window_start timestamptz not null,
  attempts integer not null default 0,
  primary key (ip_hash, window_start)
);
alter table public.checkout_attempts enable row level security;
revoke all on public.checkout_attempts from anon, authenticated;

-- Erlaubt max_attempts Versuche je Stunde. Gibt true zurück, wenn der Versuch erlaubt ist.
create function public.register_checkout_attempt(p_ip_hash text, max_attempts integer default 8)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  w timestamptz := date_trunc('hour', now());
  n integer;
begin
  insert into public.checkout_attempts (ip_hash, window_start, attempts)
  values (p_ip_hash, w, 1)
  on conflict (ip_hash, window_start)
  do update set attempts = public.checkout_attempts.attempts + 1
  returning attempts into n;
  return n <= max_attempts;
end;
$$;

-- Bezahlte Buchung verbuchen. Idempotent.
-- Ergebnis: 'paid' (neu bezahlt), 'already' (war schon bezahlt), 'conflict' (Zeitfenster
-- inzwischen anderweitig vergeben → Buchung storniert, Erstattung nötig), 'not_found'.
create function public.mark_booking_paid(
  p_booking_id uuid,
  p_session_id text,
  p_payment_intent text,
  p_amount_total integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    return 'not_found';
  end if;
  if b.status = 'paid' then
    return 'already';
  end if;

  begin
    update public.bookings
       set status = 'paid',
           paid_at = now(),
           stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_session_id),
           stripe_payment_intent_id = p_payment_intent,
           hold_expires_at = null
     where id = p_booking_id;
  exception when unique_violation then
    -- Reservierung war abgelaufen und das Zeitfenster wurde inzwischen an jemand anderen vergeben.
    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           stripe_payment_intent_id = p_payment_intent,
           cancel_reason = 'Zahlung nach Ablauf der Reservierung, Zeitfenster bereits vergeben – Erstattung in Stripe nötig'
     where id = p_booking_id;
    return 'conflict';
  end;

  if p_amount_total is distinct from b.amount_total_cents then
    raise warning 'Betrag weicht ab: Buchung % erwartet %, Stripe meldet %',
      p_booking_id, b.amount_total_cents, p_amount_total;
  end if;
  return 'paid';
end;
$$;

-- Reservierung freigeben (Stripe-Session abgelaufen oder Gast hat abgebrochen).
create function public.mark_booking_expired(p_booking_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with u as (
    update public.bookings set status = 'expired'
     where id = p_booking_id and status = 'pending'
    returning 1
  )
  select exists (select 1 from u);
$$;

create function public.set_booking_invoice_url(p_booking_id uuid, p_url text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.bookings set stripe_invoice_url = p_url where id = p_booking_id;
$$;

-- Erfolgsseite: nur Vorname, Termin, Buchungscode und Status – anhand der Stripe-Session-ID.
create function public.get_success_info(p_session_id text)
returns table (
  first_name text,
  slot_date date,
  start_time time,
  end_time time,
  booking_code text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.first_name, b.date, b.start_time, b.end_time, b.booking_code, b.status
    from public.bookings b
   where p_session_id like 'cs\_%'
     and b.stripe_checkout_session_id = p_session_id
   limit 1;
$$;

revoke execute on function public.register_checkout_attempt(text, integer) from public, anon, authenticated;
revoke execute on function public.mark_booking_paid(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.mark_booking_expired(uuid) from public, anon, authenticated;
revoke execute on function public.set_booking_invoice_url(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_success_info(text) from public;
grant execute on function public.get_success_info(text) to anon, authenticated;

-- Alte Zähler stündlich löschen (Datenminimierung).
select cron.schedule(
  'cleanup-checkout-attempts',
  '17 * * * *',
  $$delete from public.checkout_attempts where window_start < now() - interval '24 hours';$$
);
