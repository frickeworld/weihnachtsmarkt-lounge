-- pgTAP: Knappheit zählt nur echte freie Zeitfenster
begin;
select plan(3);

update public.settings set season_start = current_date, season_end = current_date + 13;

create temp table before as select * from public.get_scarcity();
grant select on before to anon;
-- Ein Freitagabend wird gebucht
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, paid_at)
select d, '20:00', '22:00', 'paid', 'K', 'Test', 'k@test.de', '0123456', 4, now()
  from generate_series(current_date + 2, current_date + 9, interval '1 day') d
 where extract(isodow from d) = 5
 limit 1;

set local role anon;
select is((select free_total from public.get_scarcity()), (select free_total - 1 from before), 'eine Buchung = ein freies Zeitfenster weniger');
select is((select free_weekend_eve from public.get_scarcity()), (select free_weekend_eve - 1 from before), 'Freitag 20:00 zählt als Wochenend-Abend');
select is((select offered_total from public.get_scarcity()), (select offered_total from before), 'Gebuchte bleiben im Angebot gezählt');
reset role;

select * from finish();
rollback;
