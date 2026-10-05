-- pgTAP-Tests für Phase 2: Rechte, Doppelbuchung, Verfügbarkeit, Tracking.
-- Ausführen: npx supabase test db
begin;
select plan(33);

-- ---------- Hilfsdaten ----------
-- Testnutzer anlegen (auth.users) und Rollen vergeben.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.de'),
  ('00000000-0000-0000-0000-00000000000b', 'haendler@test.de'),
  ('00000000-0000-0000-0000-00000000000c', 'niemand@test.de');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'studio_admin'),
  ('00000000-0000-0000-0000-00000000000b', 'haendler');

-- Saison so legen, dass gestern bis in 30 Tagen drin ist.
update public.settings
   set season_start = current_date - 1, season_end = current_date + 30;

-- Einen Montag in der Zukunft innerhalb der Saison finden (Zeitfenster 14:30/16:45/19:00).
create temp table t_day as
  select d::date as d
    from generate_series(current_date + 3, current_date + 10, interval '1 day') d
   where extract(isodow from d) = 1
   limit 1;
grant select on t_day to anon, authenticated;

-- ---------- Seeds ----------
select is((select count(*)::int from public.settings), 1, 'genau eine settings-Zeile');
select is((select count(*)::int from public.slot_templates where active), 21, '21 Zeitfenster-Vorlagen (7 Tage × 3)');
select results_eq(
  $$select start_time::text from public.slot_templates where weekday = 6 and active order by start_time$$,
  $$values ('15:30:00'), ('17:45:00'), ('20:00:00')$$,
  'Samstag: 15:30, 17:45 und 20:00'
);

-- ---------- Beträge werden aus dem Preis des Zeitfensters kopiert ----------
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, hold_expires_at)
select '11111111-1111-1111-1111-111111111111', d, '16:45', '18:45', 'paid', 'Anna', 'Muster', 'anna@test.de', '0123456', 8, 'firmenfeier', null
  from t_day;

select results_eq(
  $$select price_cents, fee_cents, taler_cents, haendler_share_cents, amount_total_cents
      from public.bookings where id = '11111111-1111-1111-1111-111111111111'$$,
  $$values (14550, 350, 7500, 11025, 14900)$$,
  'Montag 16:45: 149 € inkl. 3,50 € Gebühr, 75 € Freiverzehr, Händler 75 € + ½ × 70,50 € = 110,25 €'
);
select matches(
  (select booking_code from public.bookings where id = '11111111-1111-1111-1111-111111111111'),
  '^HL-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$',
  'Buchungscode im Format HL-XXXX-XXXX ohne verwechselbare Zeichen'
);
select matches(
  (select ticket_token from public.bookings where id = '11111111-1111-1111-1111-111111111111'),
  '^[A-Za-z0-9]{32}$',
  'Ticket-Token hat 32 Zeichen'
);
select throws_ok(
  $$update public.bookings set price_cents = 1 where id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001', 'Beträge einer Buchung dürfen nicht geändert werden',
  'gespeicherte Beträge sind unveränderlich'
);

-- Spätere Preisänderung betrifft alte Buchung nicht.
update public.slot_templates set price_cents = 19900 where weekday = 1 and start_time = '16:45';
select is(
  (select amount_total_cents from public.bookings where id = '11111111-1111-1111-1111-111111111111'),
  14900, 'Preisänderung wirkt nicht auf bestehende Buchung'
);
update public.slot_templates set price_cents = 14900 where weekday = 1 and start_time = '16:45';

-- ---------- Doppelbuchung ----------
select throws_ok(
  $$insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, hold_expires_at)
    select d, '16:45', '18:45', 'pending', 'Ben', 'B', 'b@test.de', '0123456', 2, 'freunde', now() + interval '30 min' from t_day$$,
  '23505', null,
  'zweite Buchung im selben Zeitfenster scheitert am Unique-Index'
);

insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, hold_expires_at)
select d, '19:00', '21:00', 'pending', 'Cem', 'C', 'c@test.de', '0123456', 2, 'freunde', now() - interval '1 min' from t_day;

select lives_ok(
  $$update public.bookings set status = 'cancelled' where id = '11111111-1111-1111-1111-111111111111'$$,
  'Storno setzt Status'
);
select lives_ok(
  $$insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, hold_expires_at)
    select d, '16:45', '18:45', 'pending', 'Dora', 'D', 'd@test.de', '0123456', 4, 'familienfeier', now() + interval '30 min' from t_day$$,
  'nach Storno ist das Zeitfenster wieder buchbar'
);

-- ---------- Verfügbarkeit ----------
-- Die abgelaufene Reservierung (19:00) wird beim Abruf freigegeben.
select results_eq(
  $$select start_time::text, status from public.get_availability((select d from t_day), (select d from t_day))$$,
  $$values ('14:30:00', 'free'), ('16:45:00', 'taken'), ('19:00:00', 'free')$$,
  'pending zählt als belegt, abgelaufene Reservierung ist wieder frei'
);
select is(
  (select status from public.bookings where first_name = 'Cem'), 'expired',
  'expire_stale_holds setzt abgelaufene Reservierung auf expired'
);

insert into public.blocked_slots (date, start_time, reason) select d, '19:00', 'Test' from t_day;
select is(
  (select status from public.get_availability((select d from t_day), (select d from t_day)) where start_time = '19:00'),
  'blocked', 'gesperrtes Zeitfenster'
);

insert into public.closed_dates (date, reason) select d + 1, 'Test' from t_day;
select results_eq(
  $$select distinct status from public.get_availability((select d + 1 from t_day), (select d + 1 from t_day))$$,
  $$values ('closed')$$,
  'Schließtag'
);

select results_eq(
  $$select distinct status from public.get_availability(current_date + 40, current_date + 40)$$,
  $$values ('out_of_season')$$,
  'außerhalb der Saison'
);

select results_eq(
  $$select distinct status from public.get_availability(current_date - 1, current_date - 1)$$,
  $$values ('past')$$,
  'gestern ist vergangen'
);

-- Buchungsschluss: Liegt der Beginn innerhalb von booking_cutoff_minutes, ist das Zeitfenster nicht mehr buchbar.
update public.settings set booking_cutoff_minutes = 60 * 24 * 20;
select results_eq(
  $$select distinct status from public.get_availability((select d + 1 from t_day) + 1, (select d + 1 from t_day) + 1)$$,
  $$values ('past')$$,
  'Buchungsschluss greift (Beginn minus booking_cutoff_minutes)'
);
update public.settings set booking_cutoff_minutes = 60;
select is(
  public.slot_starts_at('2026-12-01', '17:00'),
  '2026-12-01 16:00:00+00'::timestamptz,
  '17:00 Berlin im Winter = 16:00 UTC'
);

select throws_ok(
  $$select * from public.get_availability(current_date, current_date + 100)$$,
  '22023', null, 'Zeitraum ist auf 62 Tage begrenzt'
);

-- ---------- Rechte: anonym ----------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$select * from public.bookings$$, '42501', null, 'anon kann bookings nicht lesen');
select throws_ok($$select * from public.settings$$, '42501', null, 'anon kann settings nicht lesen');
select throws_ok($$select * from public.page_events$$, '42501', null, 'anon kann page_events nicht lesen');
select lives_ok($$select * from public.get_availability(current_date, current_date + 7)$$, 'anon darf Verfügbarkeit abfragen');
select lives_ok($$select public.track_event('page_view', 'mobile')$$, 'anon darf page_view tracken');
select throws_ok($$select public.track_event('hack', 'mobile')$$, '22023', null, 'ungültiges Event wird abgelehnt');
select throws_ok($$select public.expire_stale_holds()$$, '42501', null, 'anon darf expire_stale_holds nicht aufrufen');

reset role;

-- get_public_settings liefert keinen PIN-Hash.
select ok(
  not exists (
    select 1 from information_schema.parameters p
      join information_schema.routines r on r.specific_name = p.specific_name
     where r.routine_name = 'get_public_settings' and p.parameter_name ilike '%pin%'
  ),
  'get_public_settings enthält keinen scanner_pin_hash'
);

-- ---------- Rechte: angemeldete Rollen ----------
set local role authenticated;

-- Händler: page_events ja, bookings nein.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal1"}';
select ok((select count(*) from public.page_events) >= 1, 'Händler sieht page_events');
select is((select count(*)::int from public.bookings), 0, 'Händler sieht keine Buchungen direkt');

-- Admin ohne 2FA: keine Buchungen.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.bookings), 0, 'Admin ohne 2FA sieht keine Buchungen');

-- Admin mit 2FA: Buchungen sichtbar, aber nicht direkt änderbar.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}';
select ok((select count(*) from public.bookings) >= 2, 'Admin mit 2FA sieht Buchungen');
select throws_ok(
  $$update public.bookings set status = 'paid'$$, '42501', null,
  'auch Admins ändern Buchungen nicht direkt (nur über Edge Functions)'
);

reset role;

select * from finish();
rollback;
