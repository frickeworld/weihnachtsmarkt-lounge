-- pgTAP Phase 6: PIN-Sperre, Scan-Ergebnisse, Taler, Liste „Heute“, Rechte
begin;
select plan(26);

update public.settings set scanner_pin_hash = extensions.crypt('482915', extensions.gen_salt('bf', 4));

-- Heute (Berlin) mit Zeitfenster über den ganzen Tag → „jetzt“ liegt sicher darin
create temp table t as select (now() at time zone 'Europe/Berlin')::date as today;
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, paid_at)
values
  ('dddddddd-0000-0000-0000-000000000001', (select today from t), '00:00', '23:59', 'paid', 'Erika', 'Heute', 'h@test.de', '0123456', 6, now()),
  ('dddddddd-0000-0000-0000-000000000002', (select today from t) + 1, '17:00', '19:00', 'paid', 'Max', 'Morgen', 'm@test.de', '0123456', 4, now()),
  ('dddddddd-0000-0000-0000-000000000003', (select today from t) + 1, '19:00', '21:00', 'paid', 'Olga', 'Override', 'o@test.de', '0123456', 3, now());
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone, persons, cancelled_at, cancel_reason)
values ('dddddddd-0000-0000-0000-000000000004', (select today from t) + 2, '17:00', '19:00', 'cancelled', 'Cara', 'Storno', 'c@test.de', '0123456', 2, now(), 'Test');
create temp table tok as
  select id, ticket_token, booking_code from public.bookings where id::text like 'dddddddd-%';

-- ---------- PIN ----------
select is(public.scanner_check_pin('ip-a', '000000') ->> 'remaining', '4', 'falsche PIN: noch 4 Versuche');
select public.scanner_check_pin('ip-a', '000000');
select public.scanner_check_pin('ip-a', '000000');
select is(public.scanner_check_pin('ip-a', '000000') ->> 'remaining', '1', 'noch 1 Versuch');
select is(public.scanner_check_pin('ip-a', '000000') ->> 'reason', 'locked', '5. Fehlversuch sperrt');
select is(public.scanner_check_pin('ip-a', '482915') ->> 'reason', 'locked', 'auch die richtige PIN bleibt 10 Minuten gesperrt');
select ok((select locked_until > now() + interval '9 minutes' from public.scanner_attempts where ip_hash = 'ip-a'), 'Sperre ca. 10 Minuten');
select is((public.scanner_check_pin('ip-b', '482915') ->> 'ok')::boolean, true, 'richtige PIN auf anderem Gerät');
select is((public.scanner_check_pin('ip-b', '482915') ->> 'version')::int, (select scanner_token_version from public.settings), 'liefert Token-Version');

-- Gerätübergreifend: 30 Fehlversuche von wechselnden Geräten → Pause für alle
select public.scanner_check_pin('ip-x' || i, '111111') from generate_series(1, 25) i;
select is(public.scanner_check_pin('ip-y', '482915') ->> 'reason', 'locked', 'nach 30 Fehlversuchen insgesamt gesperrt');
update public.scanner_attempts set locked_until = now() - interval '1 second' where ip_hash = '*global*';
select is((public.scanner_check_pin('ip-y', '482915') ->> 'ok')::boolean, true, 'nach Ablauf wieder frei');

-- ---------- Scannen ----------
select is(public.scanner_scan((select ticket_token from tok where id = 'dddddddd-0000-0000-0000-000000000001')) ->> 'result', 'ok', 'gültiger QR-Code → grün');
select ok((select checked_in_at is not null from public.bookings where id = 'dddddddd-0000-0000-0000-000000000001'), 'Check-in gesetzt');
select is(public.scanner_scan((select ticket_token from tok where id = 'dddddddd-0000-0000-0000-000000000001')) ->> 'result', 'already', 'zweiter Scan → gelb');
select is(
  public.scanner_scan(lower(replace((select booking_code from tok where id = 'dddddddd-0000-0000-0000-000000000001'), '-', ''))) ->> 'result',
  'already', 'Buchungscode klein und ohne Bindestriche wird erkannt');
select is(public.scanner_scan((select booking_code from tok where id = 'dddddddd-0000-0000-0000-000000000002')) ->> 'result', 'wrong_slot', 'anderer Tag → orange');
select ok((select checked_in_at is null from public.bookings where id = 'dddddddd-0000-0000-0000-000000000002'), 'ohne Bestätigung kein Check-in');
select is(public.scanner_scan((select booking_code from tok where id = 'dddddddd-0000-0000-0000-000000000003'), true) ->> 'result', 'override', '„Trotzdem einchecken“');
select is(public.scanner_scan((select ticket_token from tok where id = 'dddddddd-0000-0000-0000-000000000004')) ->> 'reason', 'cancelled', 'storniert → rot');
select is(public.scanner_scan('HL-XXXX-XXXX') ->> 'reason', 'unknown', 'erfundener Code → rot');
select is(public.scanner_scan('irgendwas') ->> 'result', 'invalid', 'Unsinn → rot');

-- ---------- Offline-Nachtrag ----------
select is(
  (public.scanner_scan((select booking_code from tok where id = 'dddddddd-0000-0000-0000-000000000002'), true, now() - interval '3 days', true) -> 'booking' ->> 'checked_in_at')::timestamptz > now() - interval '1 minute',
  true, 'Gerätezeit älter als 24 h wird nicht übernommen');

-- ---------- Taler ----------
select is((public.scanner_taler('dddddddd-0000-0000-0000-000000000001') ->> 'already')::boolean, false, 'Taler übergeben');
select is((public.scanner_taler('dddddddd-0000-0000-0000-000000000001') ->> 'already')::boolean, true, 'zweites Mal: schon übergeben');
select is((public.scanner_taler('dddddddd-0000-0000-0000-000000000004') ->> 'ok')::boolean, false, 'storniert: keine Taler');

-- ---------- Heute ----------
select is(
  (select b ->> 'token_hash' from jsonb_array_elements(public.scanner_today() -> 'bookings') b where b ->> 'id' = 'dddddddd-0000-0000-0000-000000000001'),
  encode(extensions.digest((select ticket_token from tok where id = 'dddddddd-0000-0000-0000-000000000001'), 'sha256'), 'hex'),
  'Liste „Heute“ enthält nur den Hash des Tokens');
select ok(not (public.scanner_today()::text like '%h@test.de%'), 'keine E-Mail-Adressen in der Liste');

-- ---------- Rechte ----------
set local role authenticated;
select throws_ok($$select public.scanner_scan('HL-XXXX-XXXX')$$, '42501', null, 'nur über die Edge Function (service_role)');
reset role;

select * from finish();
rollback;
