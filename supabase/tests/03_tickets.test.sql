-- pgTAP-Tests für Phase 4: Online-Ticket und Erinnerungen.
begin;
select plan(11);

-- Buchungen am 5.12.2026 (Samstag, 17:30 und 19:30). Beträge setzt der Trigger.
insert into public.bookings (id, date, start_time, end_time, status, first_name, last_name, email, phone,
                             persons, occasion, hold_expires_at, created_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026-12-05', '17:30', '19:30', 'paid', 'Anna', 'A', 'a@test.de', '0123456', 4, 'freunde', null, '2026-12-01 12:00+01'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '2026-12-05', '19:30', '21:30', 'paid', 'Ben', 'B', 'b@test.de', '0123456', 4, 'freunde', null, '2026-12-05 11:00+01'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '2026-12-06', '17:30', '19:30', 'pending', 'Cem', 'C', 'c@test.de', '0123456', 4, 'freunde', now() + interval '30 min', '2026-12-01 12:00+01');

-- ---------- Online-Ticket ----------
create temp table t_tok as select ticket_token from public.bookings where id = 'aaaaaaaa-0000-0000-0000-000000000001';
grant select on t_tok to anon;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select results_eq(
  $$select first_name, persons, status from public.get_ticket((select ticket_token from t_tok))$$,
  $$values ('Anna'::text, 4, 'paid'::text)$$,
  'get_ticket liefert Vorname, Personen und Status'
);
reset role;
select is(
  (select count(*)::int from public.get_ticket((select ticket_token from public.bookings where id = 'aaaaaaaa-0000-0000-0000-000000000003'))),
  0, 'pending-Buchung hat kein gültiges Ticket'
);
select is((select count(*)::int from public.get_ticket('kurz')), 0, 'ungültiges Token-Format');
select is((select count(*)::int from public.get_ticket(repeat('A', 32))), 0, 'unbekanntes Token');
select ok(
  not exists (select 1 from information_schema.parameters p
               join information_schema.routines r on r.specific_name = p.specific_name
              where r.routine_name = 'get_ticket' and p.parameter_name in ('email', 'phone')),
  'get_ticket gibt weder E-Mail noch Telefon heraus'
);

-- ---------- Erinnerungen ----------
select is(
  (select count(*)::int from public.claim_due_reminders(50, '2026-12-05 09:59+01')), 0,
  'vor 10:00 Uhr Berliner Zeit keine Erinnerung'
);
select results_eq(
  $$select * from public.claim_due_reminders(50, '2026-12-05 10:05+01')$$,
  $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$$,
  'um 10:05 Uhr: nur die vor 10 Uhr gebuchte Lounge (Ben hat um 11 Uhr gebucht)'
);
select is(
  (select count(*)::int from public.claim_due_reminders(50, '2026-12-05 10:20+01')), 0,
  'zweiter Lauf: keine doppelte Erinnerung'
);
select public.release_reminder_claim('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.claim_due_reminders(50, '2026-12-05 18:00+01')), 0,
  'nach Beginn des Zeitfensters keine Erinnerung mehr'
);
select is(
  (select count(*)::int from public.claim_due_reminders(50, '2026-12-05 10:30+01')), 1,
  'nach fehlgeschlagenem Versand wird erneut versucht'
);

set local role anon;
select throws_ok($$select * from public.claim_due_reminders()$$, '42501', null, 'anon darf keine Erinnerungen auslösen');
reset role;

select * from finish();
rollback;
