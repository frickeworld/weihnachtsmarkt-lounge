-- Besucher pro Tag: Hash aus IP + Browser + Tages-Zufallswert, keine IP gespeichert.
begin;
select plan(7);

delete from public.page_events;
delete from public.visitor_salts;

select set_config('request.headers',
  '{"x-forwarded-for":"203.0.113.7, 10.0.0.1","user-agent":"Testbrowser A"}', true);
select public.track_page_view('mobile', 'start', 'instagram');
select public.track_page_view('mobile', 'gewinnspiel', 'direkt');
select set_config('request.headers',
  '{"x-forwarded-for":"198.51.100.9","user-agent":"Testbrowser B"}', true);
select public.track_page_view('desktop', 'start', 'google');

select is((select count(distinct visitor)::int from public.page_events), 2,
  'zwei verschiedene Besucher, gleicher Besucher zweimal = ein Hash');
select ok(not exists (select 1 from public.page_events
                       where visitor like '%203%' or source like '%203%'),
  'IP-Adresse wird nicht gespeichert');
select ok((select bool_and(visitor ~ '^[0-9a-f]{16}$') from public.page_events),
  'nur gekürzter Hash');
select is((select count(*)::int from public.visitor_salts), 1, 'ein Zufallswert für heute');

-- Ohne Header (z. B. interne Aufrufe) wird trotzdem gezählt, nur ohne Besucher-Hash
select set_config('request.headers', '', true);
select lives_ok($$select public.track_page_view('desktop', 'start', 'direkt')$$,
  'ohne Header kein Fehler');

select throws_ok($$select * from public.visitor_salts$$, '42501', null, 'Zufallswert nicht lesbar')
  from (select set_config('role', 'authenticated', true)) x;
reset role;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f7', 'admin-visit@test.de');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000f7', 'studio_admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated","aal":"aal2"}';
select is(
  (public.admin_traffic((now() at time zone 'Europe/Berlin')::date,
                        (now() at time zone 'Europe/Berlin')::date) ->> 'visitors_today')::int,
  3, 'Besucher heute: 2 mit Hash + 1 ohne Hash');

select * from finish();
rollback;
