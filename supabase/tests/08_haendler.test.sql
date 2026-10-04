-- pgTAP Phase 7: Händler-Zugriff, keine Kontaktdaten, Rechenprobe Abrechnung
begin;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'admin7@test.de'),
  ('00000000-0000-0000-0000-0000000000b7', 'haendler7@test.de'),
  ('00000000-0000-0000-0000-0000000000c7', 'haendler-2fa@test.de'),
  ('00000000-0000-0000-0000-0000000000d7', 'niemand@test.de');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a7', 'studio_admin'),
  ('00000000-0000-0000-0000-0000000000b7', 'haendler'),
  ('00000000-0000-0000-0000-0000000000c7', 'haendler');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000c7', 'App', 'totp', 'verified', now(), now());

-- Rechenprobe: erschienen, nicht erschienen, storniert (vergangener Zeitraum) + kostenlose
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, notes, vat_id, billing_street, paid_at, checked_in_at)
values
  ('eeeeeeee-0000-0000-0000-000000000001', '2025-12-01', '17:00', '19:00', 'paid', 'Erika', 'Da', 'geheim1@test.de', '01761111', 4, 'Geheimer Wunsch', 'DE123456789', 'Geheimweg 1', '2025-11-20 10:00+01', '2025-12-01 17:05+01'),
  ('eeeeeeee-0000-0000-0000-000000000002', '2025-12-01', '19:00', '21:00', 'paid', 'Nico', 'Nichtda', 'geheim2@test.de', '01762222', 4, null, null, null, '2025-11-21 10:00+01', null);
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, cancelled_at, cancel_reason)
values ('eeeeeeee-0000-0000-0000-000000000003', '2025-12-02', '17:00', '19:00', 'cancelled', 'Stefan', 'Storno', 'geheim3@test.de', '01763333', 4, now(), 'Test');
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, source, payment_method, include_in_settlement, amount_total_cents, paid_at)
values ('eeeeeeee-0000-0000-0000-000000000004', '2025-12-03', '17:00', '19:00', 'paid', 'Gratis', 'Gast', 'geheim4@test.de', '01764444', 2, 'manual', 'kostenlos', false, 0, now());

set local role authenticated;

-- ---------- ohne Rolle ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.settlement('2025-12-01', '2025-12-07')$$, '42501', null, 'ohne Rolle: keine Abrechnung');
select throws_ok($$select * from public.haendler_bookings('2025-12-01', '2025-12-07')$$, '42501', null, 'ohne Rolle: keine Buchungen');

-- ---------- Händler mit eingerichteter 2FA, aber ohne Code ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.haendler_dashboard('2025-12-01', '2025-12-07')$$, '42501', null, 'Händler mit 2FA braucht den Code');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated","aal":"aal2"}';
select lives_ok($$select public.haendler_dashboard('2025-12-01', '2025-12-07')$$, 'mit Code freigegeben');

-- ---------- Händler ohne 2FA ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated","aal":"aal1"}';
create temp table s as select public.settlement('2025-12-01', '2025-12-07') as j;
select is((select (j ->> 'count')::int from s), 2, 'zwei Buchungen in der Abrechnung (erschienen + nicht erschienen)');
select is((select (j ->> 'haendler_cents')::int from s), 27500, 'Rechenprobe: 2 × 137,50 € = 275,00 €');
select is((select j ->> 'revenue_cents' from s), null, 'Händler sieht keinen Gesamtumsatz');
select is((select j ->> 'studio_cents' from s), null, 'Händler sieht keinen Studio-F-Anteil');
select is((select (j ->> 'no_shows')::int from s), 1, '1 × nicht erschienen (zählt trotzdem)');
select is((select (j ->> 'excluded_cancelled')::int from s), 1, 'Storno ausgewiesen, nicht berechnet');
select is((select (j ->> 'excluded_not_in_settlement')::int from s), 1, 'kostenlose Buchung ausgewiesen, nicht berechnet');
select is((select j -> 'rows' -> 0 ->> 'amount_total_cents' from s), null, 'Einzelzeilen ohne Gesamtbetrag');

create temp table hb as select * from public.haendler_bookings('2025-12-01', '2025-12-07');
select is((select count(*)::int from hb), 4, 'Buchungsliste: bezahlte (auch kostenlose) und stornierte');
select ok(not exists (
  select 1 from hb h where row_to_json(h)::text ~ 'geheim|0176|Geheimweg|Wunsch|DE123456789'
), 'keine E-Mail, Telefon, Adresse, Wünsche oder USt-ID');
select is((select no_show from hb where id = 'eeeeeeee-0000-0000-0000-000000000002'), true, '„Nicht erschienen“ markiert');
select is((select count(*)::int from public.bookings), 0, 'Händler liest die Tabelle nicht direkt (RLS)');
select throws_ok($$select public.admin_dashboard('2025-12-01', '2025-12-07')$$, '42501', null, 'Händler kommt nicht an Admin-Funktionen');

create temp table d as select public.haendler_dashboard('2025-12-01', '2025-12-07') as j;
select is((select (j ->> 'haendler_cents')::int from d), 27500, 'Kennzahl „Euer Anteil“ = 275,00 €');
select ok((select not (j ? 'studio_cents') and not (j ? 'revenue_cents') from d), 'Kennzahlen ohne Umsatz/Studio-F-Anteil');

-- ---------- Admin ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated","aal":"aal2"}';
select is((public.settlement('2025-12-01', '2025-12-07') ->> 'studio_cents')::int, 2 * 17850 - 27500, 'Admin sieht Studio-F-Anteil (2 × 41,00 €)');

reset role;
select * from finish();
rollback;
