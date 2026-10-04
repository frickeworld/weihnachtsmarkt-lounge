-- Design-Runde 2: Anlass ist optional, gesetzte Werte werden weiterhin geprüft.
begin;
select plan(2);

select lives_ok(
  $$insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, hold_expires_at)
    values ('2026-12-10', '17:00', '19:00', 'pending', 'Ohne', 'Anlass', 'o@test.de', '0123456', 2, null, now() + interval '30 min')$$,
  'Buchung ohne Anlass ist erlaubt'
);
select throws_ok(
  $$insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, hold_expires_at)
    values ('2026-12-10', '19:00', '21:00', 'pending', 'Falscher', 'Anlass', 'f@test.de', '0123456', 2, 'party', now() + interval '30 min')$$,
  '23514', null,
  'unbekannter Anlass wird abgelehnt'
);

select * from finish();
rollback;
