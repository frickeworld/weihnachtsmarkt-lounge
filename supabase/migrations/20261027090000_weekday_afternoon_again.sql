-- Entscheidung Louis (27.10.2026): Mo–Do wieder mit Nachmittag 14:30–16:30 für 99 € inkl.
-- 50 € Freiverzehr (hebt 20261007090000_drop_weekday_afternoon auf). Händler-Anteil automatisch:
-- 50 € + (99 € − 3,50 € − 50 €) / 2 = 72,75 €. Nur additiv: die alten Vorlagen werden wieder
-- eingeschaltet, Preis und Bezeichnung gesetzt.
update public.slot_templates
   set active = true,
       end_time = '16:30',
       price_cents = 9900,
       taler_count = 50,
       haendler_share_cents = null,
       label = 'Nachmittag'
 where weekday between 1 and 4
   and start_time = '14:30';

insert into public.slot_templates (weekday, start_time, end_time, active, price_cents, taler_count, label)
select wd, '14:30', '16:30', true, 9900, 50, 'Nachmittag'
  from generate_series(1, 4) wd
on conflict (weekday, start_time) do nothing;
