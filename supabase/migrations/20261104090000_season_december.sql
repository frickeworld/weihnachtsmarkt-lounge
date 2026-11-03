-- =====================================================================================
-- Saison und Feiertage (Entscheidung Louis, 04.11.2026), nur Daten:
--   Saison 30.11.–30.12.2026 (31.12. geschlossen = außerhalb der Saison).
--   Geschlossen 25. und 26.12. – die beiden Vermietungen am 26.12. entfallen.
--   27. und 28.12. normal geöffnet (vorher geschlossen).
--   Heiligabend 10–13 Uhr und die Party-Abende bleiben unverändert.
-- =====================================================================================

update public.settings
   set season_start = date '2026-11-30',
       season_end = date '2026-12-30',
       updated_at = now()
 where id = 1;

delete from public.closed_dates where date in ('2026-12-27', '2026-12-28');

insert into public.closed_dates (date, reason) values
  ('2026-12-25', '1. Weihnachtsfeiertag'),
  ('2026-12-26', '2. Weihnachtsfeiertag')
on conflict (date) do update set reason = excluded.reason;

-- Vermietungen am 26.12. entfernen (nur wenn dort nichts gebucht ist)
delete from public.slot_specials s
 where s.date = '2026-12-26'
   and not exists (
     select 1 from public.bookings b
      where b.date = s.date and b.start_time = s.start_time and b.status in ('pending', 'paid')
   );
delete from public.extra_slots e
 where e.date = '2026-12-26'
   and not exists (
     select 1 from public.bookings b
      where b.date = e.date and b.start_time = e.start_time and b.status in ('pending', 'paid')
   );
