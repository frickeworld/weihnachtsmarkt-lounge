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

select is((select season_start || ' ' || season_end from public.settings), '2026-11-30 2026-12-30',
  'Saison 30.11.–30.12.2026');

-- Party-Abende
select results_eq(
  $$select slot_date, to_char(start_time, 'HH24:MI'), total_cents, taler_count, share, special_title
      from av where slot_date in ('2026-12-22','2026-12-23','2026-12-29','2026-12-30')
       and special_title is not null order by 1, 2$$,
  $$select d::date, t, 19845, 100, 14450,
       case d when '2026-12-22' then 'Jingle Beatz'
              when '2026-12-23' then 'Coming Home for Christmas'
              when '2026-12-29' then '80er- & 90er-Party mit DJ'
              else 'Discofox zum Jahresausklang' end
      from unnest(array['2026-12-22','2026-12-23','2026-12-29','2026-12-30']) d,
           unnest(array['16:45','19:00']) t order by 1, 2$$,
  'Party-Abende 22./23./29./30.12. je 16:45 und 19:00 mit Programm-Titel: 198,45 € (189 € + 5 %) inkl. 100 €, Händler 144,50 €');

-- Heiligabend: nur 10:00–13:00
select results_eq(
  $$select to_char(start_time, 'HH24:MI'), to_char(end_time, 'HH24:MI'), status, total_cents, taler_count, share, label
      from av where slot_date = '2026-12-24'$$,
  $$values ('10:00', '13:00', 'free', 31395, 150, 22450, 'Vormittag'::text)$$,
  'Heiligabend: nur 10–13 Uhr, 313,95 € (299 € + 5 %) inkl. 150 €, Händler 224,50 €');

-- 25. und 26.12. geschlossen (die Vermietungen am 26.12. entfallen), 27. und 28.12. normal
select is((select count(*)::int from av where slot_date in ('2026-12-25', '2026-12-26') and status <> 'closed'),
  0, '25. und 26.12. geschlossen');
select results_eq(
  $$select slot_date, to_char(start_time, 'HH24:MI'), status, total_cents
      from av where slot_date in ('2026-12-27', '2026-12-28') order by 1, 2$$,
  $$values ('2026-12-27'::date, '14:30', 'free', 15645), ('2026-12-27', '16:45', 'free', 15645),
           ('2026-12-27', '19:00', 'free', 15645), ('2026-12-28', '14:30', 'free', 10395),
           ('2026-12-28', '16:45', 'free', 15645), ('2026-12-28', '19:00', 'free', 15645)$$,
  '27. (So) und 28.12. (Mo) normal geöffnet');
select is((select count(*)::int from av where slot_date = '2026-12-31' and status <> 'out_of_season'),
  0, '31.12. außerhalb der Saison');
select is((select count(*)::int from av where slot_date = '2026-12-21' and special_title is null and total_cents = 15645),
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
  $$values (31395, 15000, 22450)$$, 'Buchung übernimmt 313,95 € / 150 € / 224,50 €');
select throws_ok(
  $$insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, hold_expires_at)
    values ('2026-12-24', '10:00', '13:00', 'pending', 'X', 'Y', 'x@test.de', '0123456', 2, now() + interval '30 min')$$,
  '23505', null, 'Heiligabend nur einmal verkaufbar');
select is((select status from public.get_availability('2026-12-24', '2026-12-24')), 'taken', 'Heiligabend danach vergeben');

-- Gewinn-Codes gelten nicht für Sonderveranstaltungen
insert into public.discount_codes (code, kind, percent, valid_until, weekdays, allow_specials)
values ('GEWINN-TEST1', 'gewinn', 100, '2026-12-30', null, false);
select is((select reason from public.discount_pricing('GEWINN-TEST1', '2026-12-22', '19:00')), 'special',
  'Gewinn-Code nicht an Party-Abenden');

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
-- 24.12.: 1 (gebucht zählt mit), 25./26.12.: 0, 27. und 28.12.: je 3
select is((public.admin_dashboard('2026-12-24', '2026-12-28') ->> 'available_slots')::int, 7,
  'Dashboard: 24.12. ein Zeitfenster, 25./26.12. keins, 27./28.12. je drei');
reset role;

select * from finish();
rollback;
