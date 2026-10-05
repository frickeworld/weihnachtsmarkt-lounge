-- pgTAP: Warteliste – nur bei ausgebuchten Tagen fällig, einmal reserviert, nicht öffentlich
begin;
select plan(6);

-- Dienstag 01.12.2026: alle drei Zeitfenster reserviert → ausgebucht
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, hold_expires_at)
select ('eeeeeeee-0000-0000-0000-00000000000' || n)::uuid, '2026-12-01', st::time, et::time, 'pending', 'W', 'Test', 'w@test.de', '0123456', 4, now() + interval '30 min'
  from (values (1, '14:30', '16:30'), (2, '16:45', '18:45'), (3, '19:00', '21:00')) v(n, st, et);

insert into public.waitlist (date, email) values ('2026-12-01', 'gast@example.de');

select is((select count(*)::int from public.claim_waitlist_notifications(50)), 0,
  'ausgebuchter Tag: keine Benachrichtigung');

-- Ein Zeitfenster wird frei
delete from public.bookings where id = 'eeeeeeee-0000-0000-0000-000000000002';
select results_eq($$select date, email from public.claim_waitlist_notifications(50)$$,
  $$values ('2026-12-01'::date, 'gast@example.de'::text)$$, 'frei geworden: Eintrag wird reserviert');
select is((select count(*)::int from public.claim_waitlist_notifications(50)), 0,
  'reservierter Eintrag wird nicht doppelt vergeben');

select throws_ok($$insert into public.waitlist (date, email) values ('2026-12-01', 'GROSS@example.de')$$,
  '23514', null, 'E-Mail nur in Kleinbuchstaben');

set local role anon;
select throws_ok($$select * from public.waitlist$$, '42501', null, 'Warteliste nicht öffentlich lesbar');
select throws_ok($$select * from public.claim_waitlist_notifications(1)$$, '42501', null,
  'Benachrichtigungen nur serverseitig');
reset role;

select * from finish();
rollback;
