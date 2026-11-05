-- Rabattcodes aus dem Admin: Preis, Laufzeit, Höchstzahl, Partys, Rechte.
begin;
select plan(14);

update public.settings set season_start = '2026-11-30', season_end = '2026-12-30';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'admin-promo@test.de'),
  ('00000000-0000-0000-0000-0000000000e2', 'haendler-promo@test.de');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'studio_admin'),
  ('00000000-0000-0000-0000-0000000000e2', 'haendler');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.admin_create_promo_code('LOUNGE10', 10, '2026-12-30', 2, false, null)$$,
  '42501', null, 'Händler dürfen keine Codes anlegen');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","aal":"aal2"}';
select is(public.admin_create_promo_code(' lounge10 ', 10, '2026-12-30', 2, false, 'Test'), 'LOUNGE10', 'Code wird groß geschrieben angelegt');
select throws_ok($$select public.admin_create_promo_code('AB', 10, '2026-12-30', null, false, null)$$,
  '22023', null, 'zu kurzer Code abgelehnt');
select throws_ok($$select public.admin_create_promo_code('LOUNGE10', 20, '2026-12-30', null, false, null)$$,
  '23505', null, 'doppelter Code abgelehnt');
select lives_ok($$select public.admin_create_promo_code('ALT5', 5, '2026-01-01', null, false, null)$$, 'abgelaufener Code anlegbar');
select lives_ok($$select public.admin_create_promo_code('PARTY15', 15, '2026-12-30', null, true, null)$$, 'Party-Code anlegbar');
reset role;

-- Dienstag 08.12. 16:45: 156,45 € (149 € + 7,45 € Gebühr), 75 € Freiverzehr
select results_eq(
  $$select reason, total_cents, discount_cents, haendler_share_cents from public.code_pricing('lounge10', '2026-12-08', '16:45')$$,
  $$values (null::text, 14080, 1565, 9601)$$,
  '10 %: 156,45 € → 140,80 €, Händler 72 % vom rabattierten Lounge-Preis');
select is((select source from public.code_pricing('LOUNGE10', '2026-12-08', '16:45')), 'promo', 'Quelle promo');
select is((select reason from public.code_pricing('ALT5', '2026-12-08', '16:45')), 'expired', 'abgelaufen');
select is((select reason from public.code_pricing('LOUNGE10', '2026-12-22', '16:45')), 'special', 'nicht an Party-Abenden');
select is((select reason from public.code_pricing('PARTY15', '2026-12-22', '16:45')), null, 'Party-Code gilt an Party-Abenden');
select is((select reason from public.preview_discount('NIX', '2026-12-08', '16:45')), 'unknown', 'unbekannter Code');

-- Höchstzahl 2 Einlösungen
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, paid_at, promo_code)
values ('2026-12-09', '16:45', '18:45', 'paid', 'A', 'A', 'a@test.de', '0123456', 2, now(), 'LOUNGE10'),
       ('2026-12-10', '16:45', '18:45', 'paid', 'B', 'B', 'b@test.de', '0123456', 2, now(), 'LOUNGE10');
select is((select reason from public.code_pricing('LOUNGE10', '2026-12-08', '16:45')), 'used_up', 'nach 2 Einlösungen ausgeschöpft');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","aal":"aal2"}';
select is((select uses from public.admin_promo_codes() where code = 'LOUNGE10'), 2, 'Admin sieht Einlösungen');

select * from finish();
rollback;
