-- Kürzere Texte für die Party-Abende (Entscheidung Louis, 05.11.2026: am Handy zu viel Text)
-- und der 30.12. als Schlagerparty statt Discofox-Abend. Nur Texte – Preise, Taler und
-- Händler-Anteile bleiben unverändert. Im Admin weiter änderbar.

update public.slot_specials
   set act = 'powered by STUDIO/F',
       description = 'Die größten Disco-Hits zum Mitfeiern auf Frickes Tanzfläche.'
 where date = '2026-12-22' and start_time in ('16:45', '19:00');

update public.slot_specials
   set act = 'All Time Classics',
       description = 'Die Party vor Heiligabend – Hits zum Mitsingen und Tanzen.'
 where date = '2026-12-23' and start_time in ('16:45', '19:00');

update public.slot_specials
   set act = 'präsentiert von der Tanzschule Fricke',
       description = 'Die Hits der 80er und 90er – vorher kostenloser Discofox-Workshop.'
 where date = '2026-12-29' and start_time in ('16:45', '19:00');

update public.slot_specials
   set title = 'Schlagerparty zum Jahresausklang',
       act = 'Die größten Schlager zum Mitsingen',
       description = 'Der letzte Partyabend des Jahres auf Frickes Tanzfläche.'
 where date = '2026-12-30' and start_time in ('16:45', '19:00');

update public.slot_specials
   set description = 'Drei Stunden Lounge am Heiligabend-Vormittag – exklusiv für dich und deine Gäste.'
 where date = '2026-12-24' and start_time = '10:00';
