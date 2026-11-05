-- Händler sehen das Gewinnspiel nur zusammengefasst (keine E-Mails); Fremde gar nicht.
begin;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'haendler3@test.de'),
  ('00000000-0000-0000-0000-0000000000d2', 'niemand@test.de');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000d1', 'haendler');
insert into public.giveaway_entries (email, first_name, last_name, consent_version, confirmed_at)
values ('gewinner@test.de', 'Greta', 'Gewinn', 'v1', now()), ('offen@test.de', 'Otto', 'Offen', 'v1', null);
insert into public.giveaway_draws (pool_size, lots, winner_entry_id)
select 1, 1, id from public.giveaway_entries where email = 'gewinner@test.de';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal1"}';
select is((public.haendler_giveaway_summary() ->> 'entries_confirmed')::int, 1, 'bestätigte Teilnehmer');
select is((public.haendler_giveaway_summary() ->> 'entries_pending')::int, 1, 'unbestätigte Teilnehmer');
select is(public.haendler_giveaway_summary() -> 'draws' -> 0 ->> 'winner', 'Greta G.', 'Gewinner nur mit Vorname und Initial');
select ok(position('@' in public.haendler_giveaway_summary()::text) = 0, 'keine E-Mail-Adressen');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.haendler_giveaway_summary()$$, '42501', null, 'ohne Rolle gesperrt');

select * from finish();
rollback;
