-- Bezeichnungen der Zeitfenster für die Preisübersicht (Entscheidung Louis, 07.10.2026):
-- je Zeitfenster eine eigene Zeile – „Nachmittag“, „Früher Abend“, „Später Abend“.
-- Nur Text; Preise und Zeiten bleiben unverändert.
update public.slot_templates set label = 'Nachmittag'
 where start_time in ('14:30', '15:30');
update public.slot_templates set label = 'Früher Abend'
 where start_time in ('16:45', '17:45');
update public.slot_templates set label = 'Später Abend'
 where start_time in ('19:00', '20:00');
