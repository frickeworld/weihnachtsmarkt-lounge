-- Sperren für die Werbegemeinschaft (Die Händler), Wunsch Louis 05.11.2026. Nur Daten.
-- Fr/Sa gibt es kein 16:45-Fenster: 16:45–18:45 deckt dort 15:30 und 17:45 ab, beide gesperrt.
-- Im Admin unter Kalender wieder aufhebbar.
insert into public.blocked_slots (date, start_time, reason) values
  ('2026-12-09', '14:30', 'Werbegemeinschaft (Die Händler)'),
  ('2026-12-11', '15:30', 'Werbegemeinschaft (Die Händler)'),
  ('2026-12-11', '17:45', 'Werbegemeinschaft (Die Händler)'),
  ('2026-12-19', '15:30', 'Werbegemeinschaft (Die Händler)'),
  ('2026-12-19', '17:45', 'Werbegemeinschaft (Die Händler)')
on conflict (date, start_time) do nothing;
