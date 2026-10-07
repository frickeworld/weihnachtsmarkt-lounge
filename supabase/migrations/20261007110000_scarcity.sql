-- Ehrliche Knappheit für die Website (additiv): echte Zahlen freier Zeitfenster ab heute.
--   free_total        = alle noch buchbaren Zeitfenster der Saison
--   offered_total     = alle noch kommenden Zeitfenster (frei + gebucht)
--   free_weekend_eve  = freie Fr/Sa-Abende (17:45 und 20:00, die gefragtesten)
create function public.get_scarcity()
returns table (free_total integer, offered_total integer, free_weekend_eve integer)
language sql
volatile
security definer
set search_path = ''
as $$
  with s as (select season_end from public.settings where id = 1),
  a as (
    select g.*
      from s,
           public.get_availability(
             (now() at time zone 'Europe/Berlin')::date, s.season_end
           ) g
     where g.status in ('free', 'taken')
  )
  select count(*) filter (where status = 'free')::int,
         count(*)::int,
         count(*) filter (
           where status = 'free'
             and extract(isodow from slot_date) in (5, 6)
             and start_time in ('17:45', '20:00')
         )::int
    from a;
$$;

revoke execute on function public.get_scarcity() from public;
grant execute on function public.get_scarcity() to anon, authenticated;
