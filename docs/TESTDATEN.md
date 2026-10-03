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

## Aufräumen

```sql
delete from public.bookings where email = 'test@example.de';
delete from public.closed_dates where reason = 'Test';
delete from public.blocked_slots where reason = 'Test';
delete from public.page_events; -- nur vor dem Livegang!
```
