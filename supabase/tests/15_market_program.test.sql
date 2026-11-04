-- pgTAP: Programm des Weihnachtsmarkts – öffentlich lesbar über get_market_program(), Tabelle nicht
begin;
select plan(5);

-- Saison und „heute“ unabhängig vom Testdatum: Saison um den heutigen Tag legen
-- Seed aus dem Programmheft: 11 Freitags-/Samstags-Acts
select is((select count(*)::int from public.market_program where extract(isodow from date) in (5, 6)), 11,
  'Programmheft: 11 Abend-Acts freitags und samstags');

update public.settings set season_start = current_date - 10, season_end = current_date + 30;
delete from public.market_program;
insert into public.market_program (date, start_time, end_time, title, description, location) values
  (current_date - 1, '19:00', null, 'Gestern', null, 'Winterbühne'),
  (current_date + 2, '19:00', null, 'Band B', 'Rock', 'Winterbühne'),
  (current_date + 2, '17:00', null, 'Band A', null, 'Winterbühne'),
  (current_date + 40, '19:00', null, 'Nach der Saison', null, 'Winterbühne');

set local role anon;
select results_eq(
  $$select title from public.get_market_program()$$,
  $$values ('Band A'::text), ('Band B'::text)$$,
  'öffentlich: kommende Programmpunkte der Saison, nach Zeit sortiert');
select throws_ok($$select * from public.market_program$$, '42501', null, 'Tabelle nicht öffentlich');
reset role;

-- Programmpunkte ändern keine Preise und sind keine Sonderveranstaltungen
select is((select special_title from public.slot_pricing(current_date + 2, '19:00')), null,
  'kein Sondertermin durch Programm');
select throws_ok($$insert into public.market_program (date, start_time, title) values (current_date, '18:00', '')$$,
  '23514', null, 'Titel Pflicht');

select * from finish();
rollback;
