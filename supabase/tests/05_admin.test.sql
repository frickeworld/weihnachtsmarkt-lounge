-- pgTAP-Tests Phase 5: Admin-Funktionen, 2FA-Pflicht, Kennzahlen.
begin;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.de'),
  ('00000000-0000-0000-0000-0000000000b1', 'haendler@test.de');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'studio_admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'haendler');

update public.settings set season_start = '2026-12-01', season_end = '2026-12-07';
create temp table pin_before as select scanner_token_version as v from public.settings;
grant select on pin_before to authenticated;

-- Drei bezahlte Buchungen (eine erschienen, eine nicht, eine wird storniert) + eine kostenlose
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, paid_at, source)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', '2026-12-01', '17:00', '19:00', 'paid', 'Anna', 'A', 'a@test.de', '0123456', 4, 'freunde', '2026-11-20 10:00+01', 'online'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '2026-12-01', '19:00', '21:00', 'paid', 'Ben', 'B', 'b@test.de', '0123456', 4, null, '2026-11-21 10:00+01', 'online'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '2026-12-02', '17:00', '19:00', 'paid', 'Cem', 'C', 'c@test.de', '0123456', 4, 'firmenfeier', '2026-11-22 10:00+01', 'online');
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, source, payment_method, include_in_settlement, amount_total_cents)
values ('bbbbbbbb-0000-0000-0000-000000000004', '2026-12-03', '17:00', '19:00', 'paid', 'Dora', 'D', 'd@test.de', '0123456', 2, 'manual', 'kostenlos', false, 0);

insert into public.page_events (event_type, device, created_at) values
  ('page_view', 'mobile', '2026-12-01 12:00+01'), ('page_view', 'desktop', '2026-12-01 13:00+01'),
  ('book_click', 'mobile', '2026-12-01 12:01+01');

-- ---------- ohne 2FA: alles gesperrt ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.admin_dashboard('2026-12-01', '2026-12-07')$$, '42501', null, 'Kennzahlen ohne 2FA gesperrt');
select throws_ok($$select public.admin_check_in('bbbbbbbb-0000-0000-0000-000000000001')$$, '42501', null, 'Check-in ohne 2FA gesperrt');
select throws_ok($$select public.admin_set_scanner_pin('123456')$$, '42501', null, 'PIN ohne 2FA gesperrt');

-- ---------- Händler: gesperrt ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.admin_cancel_booking('bbbbbbbb-0000-0000-0000-000000000003', 'x')$$, '42501', null, 'Händler darf nicht stornieren');
select throws_ok($$select * from public.admin_list_access()$$, '42501', null, 'Händler sieht keine Zugänge');

-- ---------- Admin mit 2FA ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';

select ok(public.admin_check_in('bbbbbbbb-0000-0000-0000-000000000001') is not null, 'Check-in gesetzt');
select ok(public.admin_mark_taler('bbbbbbbb-0000-0000-0000-000000000001') is not null, 'Taler übergeben');
select throws_ok($$select public.admin_cancel_booking('bbbbbbbb-0000-0000-0000-000000000003', '  ')$$, '22023', null, 'Storno nur mit Grund');
select lives_ok($$select public.admin_cancel_booking('bbbbbbbb-0000-0000-0000-000000000003', 'Kunde krank, Erstattung in Stripe')$$, 'Storno mit Grund');
select throws_ok($$select public.admin_cancel_booking('bbbbbbbb-0000-0000-0000-000000000003', 'nochmal')$$, 'P0002', null, 'Doppel-Storno abgelehnt');

-- Kennzahlen (Woche 1.–7.12.)
create temp table k as select public.admin_dashboard('2026-12-01', '2026-12-07') as j;
select is((select (j ->> 'paid_bookings')::int from k), 3, '3 bezahlte Buchungen (Storno zählt nicht)');
select is((select (j ->> 'revenue_cents')::int from k), 2 * 17850, 'Umsatz brutto 2 × 178,50 € (kostenlose = 0)');
select is((select (j ->> 'haendler_cents')::int from k), 27500, 'Händler: 2 × 137,50 € = 275,00 € (kostenlose nicht in Abrechnung)');
select is((select (j ->> 'studio_cents')::int from k), 2 * 17850 - 27500, 'Studio-F-Anteil = Umsatz − Händler');
select is((select (j ->> 'available_slots')::int from k), 14, '7 Tage × 2 Zeitfenster verfügbar');
select is((select (j ->> 'page_views')::int from k), 2, '2 Seitenaufrufe');
select is((select (j ->> 'book_clicks')::int from k), 1, '1 Klick');
select is((select (j ->> 'checked_in')::int from k), 1, '1 Check-in');
select is((select (j ->> 'taler_handed_out')::int from k), 1, '1 × Taler übergeben');
select is((select jsonb_array_length(j -> 'daily') from k), 7, 'Tagesreihe hat 7 Tage');

-- Scanner-PIN
select is(public.admin_set_scanner_pin('482915'), (select v + 1 from pin_before), 'PIN gesetzt, Version erhöht (alle Scanner abgemeldet)');
select throws_ok($$select public.admin_set_scanner_pin('12ab56')$$, '22023', null, 'PIN muss 6 Ziffern haben');
select throws_ok($$select scanner_pin_hash from public.settings$$, '42501', null, 'Admin kann den PIN-Hash nicht lesen');

-- Anonymisieren (Stichtag darf nicht in der Zukunft liegen)
select throws_ok($$select public.admin_anonymize_before(current_date + 1)$$, '22023', null, 'Stichtag in der Zukunft abgelehnt');
reset role;
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, company_name, notes)
values ('2025-12-05', '17:30', '19:30', 'paid', 'Alt', 'Kunde', 'alt@test.de', '0123456', 3, 'Alt GmbH', 'Wunsch');
set local role authenticated;
select is(public.admin_anonymize_before(current_date), 1, 'Buchung der Vorsaison anonymisiert, aktuelle bleiben');

reset role;
select * from finish();
rollback;
