-- =====================================================================================
-- Party-Abende und Feiertage (Entscheidung Louis, 13.10.2026), nur additiv.
--
--   22./23./29./30.12. Party-Abend, 16:45 und 19:00: 189 € inkl. 100 € Freiverzehr
--   24.12. Heiligabend exklusiv 10:00–13:00: 299 € inkl. 150 € Freiverzehr (nur dieser Termin)
--   26.12. 2. Weihnachtsfeiertag 13:00–15:00 und 16:00–18:00: 199 € inkl. 100 € Freiverzehr
--   25., 27. und 28.12. geschlossen. Saison bis 30.12.
-- Händler-Anteil automatisch (Freiverzehr + Hälfte des Rests). Bereits gepflegte Einträge
-- bleiben unverändert; alles im Admin anpassbar.
-- =====================================================================================

update public.settings
   set season_end = date '2026-12-30', updated_at = now()
 where id = 1 and season_end < date '2026-12-30';

insert into public.closed_dates (date, reason) values
  ('2026-12-25', '1. Weihnachtsfeiertag'),
  ('2026-12-27', 'Pause zwischen den Feiertagen'),
  ('2026-12-28', 'Pause zwischen den Feiertagen')
on conflict (date) do nothing;

insert into public.extra_slots (date, start_time, end_time, label) values
  ('2026-12-24', '10:00', '13:00', 'Vormittag'),
  ('2026-12-26', '13:00', '15:00', 'Mittag'),
  ('2026-12-26', '16:00', '18:00', 'Nachmittag')
on conflict (date, start_time) do nothing;

insert into public.slot_specials (date, start_time, title, price_cents, taler_count, description)
select d::date, t::time, 'Party-Abend', 18900, 100,
       'An diesem Abend wird auf dem Weihnachtsmarkt gefeiert. Du erlebst die Party aus deiner '
       || 'eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.'
  from unnest(array['2026-12-22', '2026-12-23', '2026-12-29', '2026-12-30']) d,
       unnest(array['16:45', '19:00']) t
union all
select '2026-12-24', '10:00', 'Heiligabend exklusiv', 29900, 150,
       'Nur einmal im Jahr: drei Stunden Lounge am Heiligabend-Vormittag, exklusiv für dich und '
       || 'deine Gäste – mit 150 € Freiverzehr und Tischservice. Der schönste Start in den Heiligabend.'
union all
select '2026-12-26', t::time, '2. Weihnachtsfeiertag', 19900, 100,
       'Weihnachten in der Lounge ausklingen lassen: zwei Stunden für dich und deine Gäste, '
       || 'mit 100 € Freiverzehr und Tischservice.'
  from unnest(array['13:00', '16:00']) t
on conflict (date, start_time) do nothing;
