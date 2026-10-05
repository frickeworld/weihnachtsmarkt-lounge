-- pgTAP: Sonderveranstaltungen öffentlich mit Infotext, Preis und Belegung
begin;
select plan(4);

insert into public.slot_specials (date, start_time, title, act, description, price_cents, taler_count, haendler_share_cents)
values ('2026-12-05', '20:00', 'Party-Abend', 'DJ [NAME]', 'Tanzen bis 22 Uhr.', 24900, 125, 15000),
       ('2026-12-12', '20:00', 'Live-Abend', 'Live: Weidmüller', null, 22900, 110, null),
       ('2026-12-19', '17:45', 'Stegelmann live', null, null, 22900, 110, null);
insert into public.blocked_slots (date, start_time, reason) values ('2026-12-12', '20:00', 'Test');
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, hold_expires_at)
values ('2026-12-05', '20:00', '22:00', 'pending', 'P', 'Party', 'p@test.de', '0123456', 4, now() + interval '30 min');

set local role anon;
select results_eq(
  $$select date, title, act, description, total_cents, taler_count, status from public.get_special_events()$$,
  $$values ('2026-12-05'::date, 'Party-Abend'::text, 'DJ [NAME]'::text, 'Tanzen bis 22 Uhr.'::text, 24900, 125, 'taken'::text),
           ('2026-12-19'::date, 'Stegelmann live'::text, null, null, 22900, 110, 'free'::text)$$,
  'kommende Sonderveranstaltung mit Infotext und Belegung; gesperrte fehlt');
select throws_ok($$select haendler_share_cents from public.get_special_events()$$, '42703', null, 'kein Händler-Anteil öffentlich');
reset role;

select throws_ok($$insert into public.slot_specials (date, start_time, title, price_cents, taler_count, description)
  values ('2026-12-26', '20:00', 'Zu lang', 19900, 100, repeat('x', 601))$$, '23514', null, 'Infotext höchstens 600 Zeichen');
select is((select count(*)::int from public.get_special_events() where date < current_date), 0, 'keine vergangenen Termine');

select * from finish();
rollback;
