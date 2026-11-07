-- Extra-Taler (Entscheidung Louis, 05.11.2026): ohne Gebühr, voll an die Händler, unveränderlich,
-- im Scanner und in der Abrechnung sichtbar. Trostpreis jetzt 10 %.
begin;
select plan(13);

update public.settings set season_start = '2026-11-30', season_end = '2026-12-30' where id = 1;

select is((select giveaway_discount_percent from public.settings where id = 1), 10,
  'Trostpreis im Gewinnspiel: 10 %');
select is(public.get_extra_taler_options(), array[100, 200, 300],
  'Standard-Stufen 100, 200, 300');

-- Dienstag 15.12. 16:45: 156,45 € (149 € + 7,45 €), 75 Taler, Händler 107,28 €
insert into public.bookings (id, date, start_time, end_time, status, source, payment_method,
  first_name, last_name, email, phone, persons, terms_accepted_at, extra_taler_cents)
values ('00000000-0000-0000-0000-00000000e001', '2026-12-15', '16:45', '18:45', 'paid', 'online',
  'stripe', 'Erika', 'Extra', 'erika@example.de', '0123 456789', 8, now(), 20000);

select is((select amount_total_cents from public.bookings where id = '00000000-0000-0000-0000-00000000e001'),
  15645 + 20000, 'Gesamtbetrag = Lounge inkl. Gebühr + 200 € Extra-Taler');
select is((select fee_cents from public.bookings where id = '00000000-0000-0000-0000-00000000e001'),
  745, 'keine Gebühr auf Extra-Taler');
select is((select haendler_share_cents from public.bookings where id = '00000000-0000-0000-0000-00000000e001'),
  10728 + 20000, 'Händler-Anteil + volle Extra-Taler');
select is((select amount_total_cents - haendler_share_cents from public.bookings
            where id = '00000000-0000-0000-0000-00000000e001'),
  15645 - 10728, 'Studio-F-Anteil bleibt unverändert');

select throws_ok(
  $$update public.bookings set extra_taler_cents = 0 where id = '00000000-0000-0000-0000-00000000e001'$$,
  'P0001', 'Beträge einer Buchung dürfen nicht geändert werden', 'Extra-Taler sind unveränderlich');

select throws_ok(
  $$insert into public.bookings (date, start_time, end_time, status, source, payment_method,
     first_name, last_name, email, phone, persons, terms_accepted_at, extra_taler_cents)
    values ('2026-12-16', '16:45', '18:45', 'pending', 'online', 'stripe', 'A', 'B', 'a@b.de',
            '0123 456789', 2, now(), 150)$$,
  '23514', null, 'nur ganze Taler');

-- Mit Rabatt (übergebene Beträge ohne Extra-Taler): Extra-Taler kommen ungekürzt dazu
insert into public.bookings (id, date, start_time, end_time, status, source, payment_method,
  first_name, last_name, email, phone, persons, terms_accepted_at, extra_taler_cents,
  discount_cents, amount_total_cents, fee_cents, price_cents, taler_cents, haendler_share_cents)
values ('00000000-0000-0000-0000-00000000e002', '2026-12-16', '16:45', '18:45', 'paid', 'online',
  'stripe', 'Rita', 'Rabatt', 'rita@example.de', '0123 456789', 10, now(), 10000,
  1565, 14080, 745, 13335, 7500, 9601);
select is((select array[amount_total_cents, haendler_share_cents] from public.bookings
            where id = '00000000-0000-0000-0000-00000000e002'),
  array[14080 + 10000, 9601 + 10000], 'Rabatt nur auf die Lounge, Extra-Taler voll');

select is(
  (select public.scanner_booking_json(b) ->> 'taler_count' from public.bookings b
    where b.id = '00000000-0000-0000-0000-00000000e001'),
  '275', 'Scanner: 75 Freiverzehr + 200 Extra = 275 Taler');
select is(
  (select public.scanner_booking_json(b) ->> 'extra_taler_count' from public.bookings b
    where b.id = '00000000-0000-0000-0000-00000000e001'),
  '200', 'Scanner: davon 200 extra');

select is(
  (select row(t.taler_count, t.extra_taler_count)::text
     from public.bookings b, public.get_ticket_taler(b.ticket_token) t
    where b.id = '00000000-0000-0000-0000-00000000e001'),
  '(275,200)', 'Online-Ticket: Taler zum Abholen');

-- Abrechnung (als Admin mit 2FA)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e9', 'admin-extra@test.de');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e9', 'studio_admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated","aal":"aal2"}';
select is((public.settlement('2026-12-15', '2026-12-16') ->> 'extra_taler_cents')::int, 30000,
  'Abrechnung: Summe der Extra-Taler');

select * from finish();
rollback;
