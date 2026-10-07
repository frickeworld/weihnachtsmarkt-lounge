-- pgTAP: Gewinnspiel – Rabatt-Berechnung, Code nur einmal, Ziehung mit Losen, RLS
begin;
select plan(18);

update public.settings set season_start = '2026-11-26', season_end = '2026-12-23',
       giveaway_active = true, giveaway_end = '2026-12-20', giveaway_discount_percent = 30;

-- Teilnehmer: Anna (bestätigt, 2 bestätigte Freunde → 3 Lose), Ben (bestätigt), Cem (nicht bestätigt),
-- Dora (abgemeldet)
insert into public.giveaway_entries (id, email, first_name, last_name, consent_version, confirmed_at, referred_by, unsubscribed_at) values
  ('a0000000-0000-0000-0000-000000000001', 'anna@test.de', 'Anna', 'A', 'v1', now(), null, null),
  ('a0000000-0000-0000-0000-000000000002', 'ben@test.de', 'Ben', 'B', 'v1', now(), 'a0000000-0000-0000-0000-000000000001', null),
  ('a0000000-0000-0000-0000-000000000003', 'cem@test.de', 'Cem', 'C', 'v1', null, 'a0000000-0000-0000-0000-000000000001', null),
  ('a0000000-0000-0000-0000-000000000004', 'dora@test.de', 'Dora', 'D', 'v1', now(), 'a0000000-0000-0000-0000-000000000001', now());

create temp table d1 as select * from public.giveaway_draw(null);
select is((select count(*)::int from d1), 2, 'Lostopf: nur bestätigte, nicht abgemeldete Teilnehmer');
-- Lose: Anna 1 + 2 bestätigte Freunde (Ben, Dora; Cem unbestätigt) = 3, Ben 1 → 4
select is((select lots from public.giveaway_draws order by id desc limit 1), 4, 'Lose inkl. Freunde-Bonus');
select is((select pool_size from public.giveaway_draws order by id desc limit 1), 2, 'zwei im Topf');
select is((select count(*)::int from d1 where role = 'gewinn'), 1, 'genau ein Gewinner');
select ok((select code like 'GEWINN-%' from d1 where role = 'gewinn'), 'Gewinner bekommt GEWINN-Code');
select ok((select code like 'LOUNGE-%' from d1 where role = 'trostpreis'), 'alle anderen einen LOUNGE-Code');

-- Zweite Ziehung: der Gewinner ist raus, der andere behält seinen Code
create temp table d2 as select * from public.giveaway_draw(null);
select is((select count(*)::int from d2), 1, 'Gewinner nimmt nicht mehr teil');
select is((select count(*)::int from public.discount_codes where kind = 'trostpreis'), 1,
  'Trostpreis-Code wird wiederverwendet, kein zweiter');

-- Rabatt 30 % an einem Dienstag 16:45 (149 €): 104,30 €, Freiverzehr bleibt, Händler 87,90 €
insert into public.discount_codes (code, kind, percent, weekdays, valid_until)
values ('LOUNGE-TEST30', 'trostpreis', 30, array[1, 2, 3, 4]::smallint[], '2026-12-23'),
       ('GEWINN-TEST100', 'gewinn', 100, null, '2026-12-23');
select results_eq(
  $$select reason, total_cents, discount_cents, fee_cents, price_cents, taler_cents, haendler_share_cents
      from public.discount_pricing('lounge-test30', '2026-12-01', '16:45')$$,
  $$values (null::text, 10430, 4470, 350, 10080, 7500, 8790)$$,
  '30 %: 104,30 €, Händler 87,90 €, Studio F 16,40 €');
select is((select reason from public.discount_pricing('LOUNGE-TEST30', '2026-12-04', '20:00')), 'weekday',
  'Trostpreis-Code nicht am Freitag');
select results_eq(
  $$select reason, total_cents, fee_cents, taler_cents, haendler_share_cents
      from public.discount_pricing('GEWINN-TEST100', '2026-12-04', '20:00')$$,
  $$values (null::text, 0, 0, 10000, 5000)$$,
  'Gewinn am Freitagabend: 0 €, Freiverzehr 100 €, Händler 50 € (halbe Taler)');
insert into public.slot_specials (date, start_time, title, price_cents, taler_count)
values ('2026-12-05', '20:00', 'Party', 24900, 125);
select is((select reason from public.discount_pricing('GEWINN-TEST100', '2026-12-05', '20:00')), 'special',
  'keine Sonderveranstaltungen');
select is((select reason from public.discount_pricing('GIBTS-NICHT', '2026-12-01', '16:45')), 'unknown', 'unbekannter Code');

-- Nur einmal einlösbar (reservierte Buchung zählt)
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, hold_expires_at, discount_code)
values ('2026-12-01', '16:45', '18:45', 'pending', 'R', 'Abatt', 'r@test.de', '0123456', 4, now() + interval '30 min', 'LOUNGE-TEST30');
select is((select reason from public.discount_pricing('LOUNGE-TEST30', '2026-12-02', '16:45')), 'used', 'Code bereits verwendet');

-- Datenpflege: nur Admins, danach keine Namen/E-Mails mehr
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a9', 'admin9@test.de');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a9', 'studio_admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated","aal":"aal2"}';
select is(public.admin_anonymize_giveaway(), 4, 'alle vier Teilnahmen anonymisiert');
reset role;
select is((select count(*)::int from public.giveaway_entries where email like '%@test.de'), 0, 'keine E-Mail-Adressen mehr');

-- Öffentlich: Vorschau und Eckdaten, aber keine Tabellen
set local role anon;
select is((select participants from public.get_giveaway_info()), 2, 'öffentlich: Anzahl Teilnehmer');
select throws_ok($$select * from public.giveaway_entries$$, '42501', null, 'Teilnehmer nicht öffentlich');
reset role;

select * from finish();
rollback;
