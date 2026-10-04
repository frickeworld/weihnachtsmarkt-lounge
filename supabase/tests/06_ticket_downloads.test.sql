-- pgTAP: Ticket-Token auf der Erfolgsseite, Standorttext
begin;
select plan(5);

insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, stripe_checkout_session_id, hold_expires_at)
values
  ('cccccccc-0000-0000-0000-000000000001', '2026-12-01', '17:00', '19:00', 'paid', 'A', 'A', 'a@test.de', '0123456', 2, 'cs_test_paid', null),
  ('cccccccc-0000-0000-0000-000000000002', '2026-12-01', '19:00', '21:00', 'pending', 'B', 'B', 'b@test.de', '0123456', 2, 'cs_test_pending', now() + interval '30 minutes');

create temp table expected as
  select ticket_token from public.bookings where id = 'cccccccc-0000-0000-0000-000000000001';
grant select on expected to anon;

set local role anon;
select is(
  public.get_success_ticket_token('cs_test_paid'),
  (select ticket_token from expected),
  'bezahlte Buchung liefert den Ticket-Token'
);
select is(public.get_success_ticket_token('cs_test_pending'), null, 'offene Zahlung liefert nichts');
select is(public.get_success_ticket_token('kein_cs'), null, 'ungültige Session-ID liefert nichts');
select throws_ok($$select ticket_token from public.bookings$$, '42501', null, 'anon liest Buchungen nicht direkt');
reset role;

select unalike((select lounge_location from public.settings), '%[GENAUE POSITION]%', 'Platzhalter im Standort ersetzt');

select * from finish();
rollback;
