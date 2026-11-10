-- Aufruf-Tracker: nur saubere Werte, Auswertung nur für Admins mit 2FA.
begin;
select plan(6);

delete from public.page_events;
select lives_ok($$select public.track_page_view('mobile', 'start', 'instagram')$$, 'Aufruf mit Herkunft');
select lives_ok($$select public.track_page_view('desktop', 'gewinnspiel', '<script>')$$,
  'unsaubere Herkunft wird nicht gespeichert');
select throws_ok($$select public.track_page_view('fernseher', 'start', 'x')$$, '22023', null,
  'unbekanntes Gerät abgelehnt');
select is((select array_agg(source order by source) from public.page_events),
  array['direkt', 'instagram'], 'unsaubere Herkunft zählt als direkt');

select throws_ok($$select public.admin_traffic(current_date, current_date)$$, null, null,
  'ohne Admin keine Auswertung');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'admin-traffic@test.de');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000f1', 'studio_admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","aal":"aal2"}';
select is(
  (public.admin_traffic((now() at time zone 'Europe/Berlin')::date, (now() at time zone 'Europe/Berlin')::date)
    -> 'by_source' -> 0 ->> 'count')::int, 1, 'Admin sieht Herkunft');

select * from finish();
rollback;
