-- pgTAP: Preisstaffel je Zeitfenster, Sondertermine, öffentliche Preisliste
begin;
select plan(14);

-- Woche 30.11.–06.12.2026: Mo 30.11., Fr 04.12., Sa 05.12., So 06.12.
create temp table pr as
select extract(isodow from d)::int wd, to_char(p_start, 'HH24:MI') st, p.*
  from (values ('2026-11-30'::date, '14:30'::time), ('2026-11-30', '19:00'), ('2026-12-04', '15:30'),
               ('2026-12-04', '20:00'), ('2026-12-06', '14:30'), ('2026-12-06', '16:45')) v(d, p_start),
       lateral public.slot_pricing(v.d, v.p_start) p;

select results_eq($$select total_cents, taler_count, haendler_share_cents from pr where wd = 1 and st = '14:30'$$,
  $$values (9900, 50, 7275)$$, 'Mo–Do Nachmittag (deaktiviert): Preis bleibt für bestehende/manuelle Buchungen 99 €, Händler 72,75 €');
select results_eq($$select total_cents, taler_count, haendler_share_cents from pr where wd = 1 and st = '19:00'$$,
  $$values (14900, 75, 11025)$$, 'Mo–Do Abend: 149 € inkl. 75 €, Händler 110,25 €');
select results_eq($$select total_cents, taler_count from pr where wd = 5 and st = '15:30'$$,
  $$values (14900, 75)$$, 'Fr Nachmittag: 149 € inkl. 75 €');
select results_eq($$select total_cents, taler_count, haendler_share_cents from pr where wd = 5 and st = '20:00'$$,
  $$values (19900, 100, 14775)$$, 'Fr/Sa Abend: 199 € inkl. 100 €, Händler 147,75 €');
select results_eq($$select total_cents, taler_count from pr where wd = 7 and st = '14:30'$$,
  $$values (14900, 75)$$, 'So Nachmittag: 149 € inkl. 75 €');
select results_eq($$select total_cents, taler_count from pr where wd = 7 and st = '16:45'$$,
  $$values (14900, 75)$$, 'So Abend: wie Mo–Do Abend');

-- Sondertermin (Party): eigener Preis und Freiverzehr, Händler-Anteil automatisch
insert into public.slot_specials (date, start_time, title, price_cents, taler_count)
values ('2026-12-05', '20:00', 'Party-Abend', 24900, 125);
select results_eq($$select total_cents, taler_count, haendler_share_cents, special_title from public.slot_pricing('2026-12-05', '20:00')$$,
  $$values (24900, 125, 12500 + (24900 - 350 - 12500) / 2, 'Party-Abend'::text)$$, 'Sondertermin überschreibt die Vorlage');
-- Händler-Anteil fest vorgegeben
update public.slot_specials set haendler_share_cents = 15000 where date = '2026-12-05';
select is((select haendler_share_cents from public.slot_pricing('2026-12-05', '20:00')), 15000, 'Händler-Anteil am Sondertermin überschreibbar');

-- Buchung übernimmt den Sonderpreis
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, hold_expires_at)
values ('ffffffff-0000-0000-0000-000000000001', '2026-12-05', '20:00', '22:00', 'pending', 'P', 'Party', 'p@test.de', '0123456', 4, now() + interval '30 min');
select results_eq($$select amount_total_cents, fee_cents, price_cents, taler_cents, haendler_share_cents from public.bookings where id = 'ffffffff-0000-0000-0000-000000000001'$$,
  $$values (24900, 350, 24550, 12500, 15000)$$, 'Buchung kopiert Sonderpreis (Endpreis inkl. Gebühr)');

-- Öffentliche Abfragen
set local role anon;
select results_eq($$select total_cents, taler_count, special_title from public.get_availability_priced('2026-12-05', '2026-12-05') where start_time = '20:00'$$,
  $$values (24900, 125, 'Party-Abend'::text)$$, 'Verfügbarkeit zeigt Preis und Sondertermin');
select is((select min(total_cents) from public.get_price_list()), 14900, 'Preisliste: ab 149 € (Mo–Do ohne Nachmittag)');
select is((select max(taler_count) from public.get_price_list()), 100, 'Preisliste: bis zu 100 € Freiverzehr');
select throws_ok($$select * from public.slot_pricing('2026-12-05', '20:00')$$, '42501', null, 'interne Preisfunktion nicht öffentlich');
select throws_ok($$select * from public.slot_specials$$, '42501', null, 'Sondertermine nur für Admins');
reset role;

select * from finish();
rollback;
