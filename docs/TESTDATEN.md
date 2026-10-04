# Testdaten per SQL (Supabase → SQL Editor)

Damit kannst du die Abnahme-Checklisten durchspielen, ohne echte Buchungen zu brauchen.
**Vor dem Livegang alle Testdaten wieder löschen** (Abschnitt „Aufräumen“).

## Phase 2 – Verfügbarkeit

```sql
-- Belegtes Zeitfenster: bezahlte Buchung am 27.11.2026 um 17:00
-- (Beträge, Buchungscode und Ticket-Token setzt die Datenbank automatisch)
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion)
values ('2026-11-27', '17:00', '19:00', 'paid', 'Test', 'Gast', 'test@example.de', '0123456', 6, 'freunde');

-- Geschlossener Tag
insert into public.closed_dates (date, reason) values ('2026-11-30', 'Test');

-- Einzelnes Zeitfenster sperren
insert into public.blocked_slots (date, start_time, reason) values ('2026-12-01', '19:00', 'Test');

-- Tracking ansehen
select event_type, device, count(*) from public.page_events group by 1, 2;
```

## Phase 4 – Erinnerung testen

```sql
-- Bezahlte Buchung für HEUTE, „gebucht“ gestern (sonst gibt es keine Erinnerung).
-- Eigene E-Mail-Adresse eintragen und ein Zeitfenster wählen, das heute noch nicht begonnen hat.
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, occasion, created_at)
values (current_date, '19:00', '21:00', 'paid', 'Test', 'Gast', '[DEINE-EMAIL]', '0123456', 4, 'freunde', now() - interval '1 day');

-- Nach 10:00 Uhr: sofort auslösen statt auf den 15-Minuten-Takt zu warten
select public.invoke_send_reminders();

-- Ergebnis ansehen
select b.email, b.reminder_sent_at, l.type, l.status, l.error
  from public.bookings b left join public.email_log l on l.booking_id = b.id
 where b.email = '[DEINE-EMAIL]';
```

## Aufräumen

```sql
delete from public.email_log where booking_id in (select id from public.bookings where email in ('test@example.de', '[DEINE-EMAIL]'));
delete from public.bookings where email in ('test@example.de', '[DEINE-EMAIL]');
delete from public.closed_dates where reason = 'Test';
delete from public.blocked_slots where reason = 'Test';
delete from public.page_events; -- nur vor dem Livegang!
```

## Phase 5 – Admin ausprobieren

```sql
-- Eine bezahlte Beispielbuchung für morgen (erscheint in Übersicht, Buchungen, Kalender)
insert into public.bookings (date, start_time, end_time, status, first_name, last_name, email, phone, persons, paid_at)
values (current_date + 1, '19:00', '21:00', 'paid', 'Test', 'Admin', 'test@example.de', '0123456', 6, now());

-- Wer hat welche Rolle?
select u.email, r.role from public.user_roles r join auth.users u on u.id = r.user_id;
```
