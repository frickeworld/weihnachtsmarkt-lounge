-- Entscheidung Louis (07.10.2026): Mo–Do kein Nachmittagstermin 14:30–16:30 mehr.
-- Es bleiben 16:45–18:45 und 19:00–21:00. Die Vorlagen werden nur deaktiviert (additiv,
-- nichts gelöscht) und lassen sich im Admin unter „Zeitfenster und Preise“ wieder einschalten.
-- Sonntag 14:30 bleibt unverändert.
update public.slot_templates
   set active = false
 where weekday between 1 and 4
   and start_time = '14:30';
