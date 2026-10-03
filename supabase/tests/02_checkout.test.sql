-- pgTAP-Tests für Phase 3: Statuswechsel beim Checkout, Erfolgsseite, Rechte.
begin;
select plan(16);

update public.settings set season_start = current_date, season_end = current_date + 30;

create temp table t_day as
  select d::date as d
    from generate_series(current_date + 3, current_date + 10, interval '1 day') d
   where extract(isodow from d) = 2
   limit 1;

-- Hilfsfunktion: pending-Buchung anlegen
create function pg_temp.new_pending(t time, sess text) returns uuid language sql as $$
  insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone,
                               persons, occasion, hold_expires_at, stripe_checkout_session_id)
  select d, t, t + interval '2 hours', 'pending', 'Anna', 'Muster', 'a@test.de', '0123456', 4, 'freunde',
         now() + interval '30 min', sess
    from t_day
  returning id;
$$;

create temp table ids as select pg_temp.new_pending('17:00', 'cs_test_one') as a;

-- ---------- mark_booking_paid ----------
select is(public.mark_booking_paid((select a from ids), 'cs_test_one', 'pi_1', 17850), 'paid', 'pending → paid');
select is((select status from public.bookings where id = (select a from ids)), 'paid', 'Status ist paid');
select ok((select paid_at is not null and hold_expires_at is null from public.bookings where id = (select a from ids)),
  'paid_at gesetzt, Reservierung aufgehoben');
select is(public.mark_booking_paid((select a from ids), 'cs_test_one', 'pi_1', 17850), 'already', 'zweiter Aufruf ist idempotent');
select is(public.mark_booking_paid(gen_random_uuid(), 'cs_x', 'pi_x', 1), 'not_found', 'unbekannte Buchung');

-- Abgelaufene Reservierung, Zeitfenster noch frei → Zahlung wird trotzdem verbucht.
insert into ids select pg_temp.new_pending('19:00', 'cs_test_two');
update public.bookings set status = 'expired' where stripe_checkout_session_id = 'cs_test_two';
select is(
  public.mark_booking_paid((select id from public.bookings where stripe_checkout_session_id = 'cs_test_two'), 'cs_test_two', 'pi_2', 17850),
  'paid', 'späte Zahlung bei freiem Zeitfenster wird verbucht'
);

-- Abgelaufene Reservierung, Zeitfenster inzwischen vergeben → Konflikt, Buchung storniert.
update public.bookings set status = 'cancelled' where stripe_checkout_session_id = 'cs_test_two';
insert into ids select pg_temp.new_pending('19:00', 'cs_test_three');
update public.bookings set status = 'expired' where stripe_checkout_session_id = 'cs_test_three';
insert into ids select pg_temp.new_pending('19:00', 'cs_test_four');
select is(
  public.mark_booking_paid((select id from public.bookings where stripe_checkout_session_id = 'cs_test_three'), 'cs_test_three', 'pi_3', 17850),
  'conflict', 'späte Zahlung bei vergebenem Zeitfenster → conflict'
);
select matches(
  (select status || ': ' || cancel_reason from public.bookings where stripe_checkout_session_id = 'cs_test_three'),
  '^cancelled: .*Erstattung', 'Konflikt-Buchung ist storniert und als Erstattungsfall markiert'
);

-- ---------- mark_booking_expired ----------
select is(
  public.mark_booking_expired((select id from public.bookings where stripe_checkout_session_id = 'cs_test_four')),
  true, 'pending → expired'
);
select is(public.mark_booking_expired((select a from ids limit 1)), false, 'bezahlte Buchung bleibt bezahlt');

-- ---------- register_checkout_attempt ----------
select is(public.register_checkout_attempt('hash-x', 2), true, '1. Reservierung erlaubt');
select is(public.register_checkout_attempt('hash-x', 2), true, '2. Reservierung erlaubt');
select is(public.register_checkout_attempt('hash-x', 2), false, '3. Reservierung über dem Limit');

-- ---------- Rechte ----------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select results_eq(
  $$select first_name, booking_code ~ '^HL-' from public.get_success_info('cs_test_one')$$,
  $$values ('Anna'::text, true)$$,
  'Erfolgsseite liefert Vorname und Buchungscode'
);
select throws_ok(
  $$select public.mark_booking_paid(gen_random_uuid(), 'x', 'x', 1)$$, '42501', null,
  'anon kann keine Buchung auf bezahlt setzen'
);
select throws_ok(
  $$select public.mark_booking_expired(gen_random_uuid())$$, '42501', null,
  'anon kann keine Reservierung freigeben (nur über release-hold)'
);
reset role;

select * from finish();
rollback;
