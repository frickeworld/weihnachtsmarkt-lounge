-- pgTAP: Einmalige Zeitfenster, Party-Abende und Feiertage (Migration 20261013…)
begin;
select plan(16);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.de');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'studio_admin');

create temp table av as
select a.*, p.total_cents, p.taler_count, p.special_title, p.label,
       (select x.haendler_share_cents from public.slot_pricing(a.slot_date, a.start_time) x) as share
  from public.get_availability('2026-12-21', '2026-12-31') a
  cross join lateral public.slot_pricing(a.slot_date, a.start_time) p;

select is((select season_end from public.settings), '2026-12-30'::date, 'Saison bis 30.12. verlängert');

-- Party-Abende
select results_eq(
  $$select slot_date, to_char(start_time, 'HH24:MI'), total_cents, taler_count, share, special_title
      from av where special_title = 'Party-Abend' order by 1, 2$$,
  $$select d::date, t, 18900, 100, 14275, 'Party-Abend'::text
      from unnest(array['2026-12-22','2026-12-23','2026-12-29','2026-12-30']) d,
           unnest(array['16:45','19:00']) t order by 1, 2$$,
  'Party-Abende 22./23./29./30.12. je 16:45 und 19:00: 189 € inkl. 100 €, Händler 142,75 €');

-- Heiligabend: nur 10:00–13:00
select results_eq(
  $$select to_char(start_time, 'HH24:MI'), to_char(end_time, 'HH24:MI'), status, total_cents, taler_count, share, label
      from av where slot_date = '2026-12-24'$$,
  $$values ('10:00', '13:00', 'free', 29900, 150, 22275, 'Vormittag'::text)$$,
  'Heiligabend: nur 10–13 Uhr, 299 € inkl. 150 €, Händler 222,75 €');

-- 26.12.: zwei Vermietungen statt der Samstags-Vorlagen
select results_eq(
  $$select to_char(start_time, 'HH24:MI'), to_char(end_time, 'HH24:MI'), total_cents, taler_count
      from av where slot_date = '2026-12-26' order by 1$$,
  $$values ('13:00', '15:00', 19900, 100), ('16:00', '18:00', 19900, 100)$$,
  '26.12.: 13:00 und 16:00, Vorlagen entfallen');

select is((select count(*)::int from av where slot_date in ('2026-12-25', '2026-12-27', '2026-12-28') and status <> 'closed'),
  0, '25., 27. und 28.12. geschlossen');
select is((select count(*)::int from av where slot_date = '2026-12-31' and status <> 'out_of_season'),
  0, '31.12. außerhalb der Saison');
select is((select count(*)::int from av where slot_date = '2026-12-21' and special_title is null and total_cents = 14900),
  2, 'Normale Tage unverändert');

-- Einmaliges Zeitfenster ohne Ersetzen: kommt zu den Vorlagen dazu
insert into public.extra_slots (date, start_time, end_time, label, replaces_regular)
values ('2026-12-21', '12:00', '14:00', 'Mittag', false);
select results_eq(
  $$select to_char(start_time, 'HH24:MI') from public.get_availability('2026-12-21', '2026-12-21')$$,
  $$values ('12:00'), ('14:30'), ('16:45'), ('19:00')$$,
  'Zusätzliches Zeitfenster ergänzt die Vorlagen');

-- Buchung auf einem einmaligen Zeitfenster: Beträge aus dem Sonderpreis, Doppelbuchung unmöglich
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, paid_at)
values ('2026-12-24', '10:00', '13:00', 'paid', 'H', 'Abend', 'h@test.de', '0123456', 8, now());
select results_eq(
  $$select amount_total_cents, taler_cents, haendler_share_cents from public.bookings where date = '2026-12-24'$$,
  $$values (29900, 15000, 22275)$$, 'Buchung übernimmt 299 € / 150 € / 222,75 €');
select throws_ok(
  $$insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, hold_expires_at)
    values ('2026-12-24', '10:00', '13:00', 'pending', 'X', 'Y', 'x@test.de', '0123456', 2, now() + interval '30 min')$$,
  '23505', null, 'Heiligabend nur einmal verkaufbar');
select is((select status from public.get_availability('2026-12-24', '2026-12-24')), 'taken', 'Heiligabend danach vergeben');

-- Gewinn-Codes gelten nicht für Sonderveranstaltungen
insert into public.discount_codes (code, kind, percent, valid_until, weekdays, allow_specials)
values ('GEWINN-TEST1', 'gewinn', 100, '2026-12-30', null, false);
select is((select reason from public.discount_pricing('GEWINN-TEST1', '2026-12-26', '13:00')), 'special',
  'Gewinn-Code nicht am 26.12.');

-- Rechte: öffentlich nur über get_availability
set local role anon;
select throws_ok($$select * from public.extra_slots$$, '42501', null, 'anon liest extra_slots nicht direkt');
select throws_ok($$select * from public.slot_grid('2026-12-01', '2026-12-02')$$, '42501', null, 'slot_grid nicht öffentlich');
reset role;

-- Admin (2FA) pflegt einmalige Zeitfenster; Dashboard zählt sie mit
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
select lives_ok($$insert into public.extra_slots (date, start_time, end_time) values ('2026-12-20', '11:00', '13:00')$$,
  'Admin legt einmaliges Zeitfenster an');
-- 24.12.: 1 (gebucht zählt mit), 26.12.: 2
select is((public.admin_dashboard('2026-12-24', '2026-12-26') ->> 'available_slots')::int, 3,
  'Dashboard: 24.12. ein, 25.12. kein, 26.12. zwei Zeitfenster');
reset role;

select * from finish();
rollback;
