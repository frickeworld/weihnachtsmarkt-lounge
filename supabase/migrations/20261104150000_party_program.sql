-- Party-Abende mit dem echten Programm (Flyer Weihnachtsmarkt Detmold, Entscheidung Louis 04.11.2026):
-- nur Veranstaltungen von STUDIO/F und der Tanzschule Fricke (Partys, Discofox-Workshops).
-- Nur Texte – Preise, Taler und Händler-Anteile bleiben unverändert. Im Admin weiter änderbar.

update public.slot_specials
   set title = 'Jingle Beatz',
       act = 'Disco Classics open air · powered by STUDIO/F',
       description = 'STUDIO/F holt den Club auf den Weihnachtsmarkt: die größten Disco-Hits zum '
         || 'Mitfeiern und Mittanzen auf Frickes Tanzfläche (17:30–21:45 Uhr, Eintritt frei). '
         || 'Du feierst aus deiner eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.'
 where date = '2026-12-22' and start_time in ('16:45', '19:00');

update public.slot_specials
   set title = 'Coming Home for Christmas',
       act = 'All Time Classics – die größten Hits aller Zeiten',
       description = 'Die Party vor Heiligabend auf Frickes Tanzfläche (18:00–21:45 Uhr): All Time '
         || 'Classics zum Mitsingen und Tanzen. Du feierst aus deiner eigenen überdachten Lounge – '
         || 'mit 100 € Freiverzehr und Tischservice.'
 where date = '2026-12-23' and start_time in ('16:45', '19:00');

update public.slot_specials
   set title = '80er- & 90er-Party mit DJ',
       act = 'präsentiert von der Tanzschule Fricke',
       description = 'Zum Aufwärmen um 17:00 Uhr ein kostenloser Discofox-Workshop der Tanzschule '
         || 'Fricke für Einsteiger und Fortgeschrittene, danach die Hits der 80er und 90er auf '
         || 'Frickes Tanzfläche (17:30–21:45 Uhr). Du feierst aus deiner eigenen überdachten Lounge – '
         || 'mit 100 € Freiverzehr und Tischservice.'
 where date = '2026-12-29' and start_time in ('16:45', '19:00');

update public.slot_specials
   set title = 'Discofox zum Jahresausklang',
       act = 'Discofox-Workshop der Tanzschule Fricke',
       description = 'Um 17:00 Uhr zeigt dir die Tanzschule Fricke auf Frickes Tanzfläche die '
         || 'Discofox-Schritte – kostenlos, für Einsteiger und Fortgeschrittene. Danach genießt du '
         || 'den letzten Marktabend des Jahres in deiner eigenen überdachten Lounge – mit 100 € '
         || 'Freiverzehr und Tischservice.'
 where date = '2026-12-30' and start_time in ('16:45', '19:00');
