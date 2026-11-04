-- Verarbeitungsgebühr genau 5 % auf den Cent statt Endpreis auf volle Euro gerundet
-- (Entscheidung Louis, 04.11.2026). Nur Daten, nichts wird gelöscht oder umbenannt.
--
-- Lounge-Preise bleiben (99/149/199/189/299 €). Endpreis = Lounge-Preis × 1,05 genau:
-- 103,95 / 156,45 / 208,95 / 198,45 / 313,95 €. slot_fee() leitet den Lounge-Preis weiter als
-- Endpreis ÷ 1,05 auf volle Euro ab – das ergibt bei diesen Preisen genau die 5 %. Damit bleiben
-- auch die Händler-Anteile unverändert (Freiverzehr + Hälfte von Lounge-Preis − Freiverzehr).
-- Bestehende Buchungen behalten ihre Beträge.

comment on column public.settings.fee_percent is
  'Verarbeitungsgebühr in Prozent auf den Lounge-Preis, genau auf den Cent (seit 04.11.2026). Leer = fee_cents fest.';

update public.slot_templates
   set price_cents = round((price_cents - public.slot_fee(price_cents))
                           * (1 + (select s.fee_percent from public.settings s where s.id = 1) / 100))::integer
 where price_cents is not null
   and (select s.fee_percent from public.settings s where s.id = 1) is not null;

update public.slot_specials
   set price_cents = round((price_cents - public.slot_fee(price_cents))
                           * (1 + (select s.fee_percent from public.settings s where s.id = 1) / 100))::integer
 where (select s.fee_percent from public.settings s where s.id = 1) is not null;
