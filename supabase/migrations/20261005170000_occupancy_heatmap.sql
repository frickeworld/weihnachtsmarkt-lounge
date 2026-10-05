-- Auslastung je Wochentag und Zeitfenster für Admin- und Händler-Dashboard (additiv, nur lesen).
--   offered = angebotene Zeitfenster im Zeitraum (Saison, ohne Schließtage und Sperren)
--   booked  = bezahlte Buchungen, revenue_cents = Umsatz dieser Buchungen (nur für Admins,
--             Händler sehen keinen Gesamtumsatz → null)
create function public.occupancy_heatmap(p_from date, p_to date)
returns table (
  weekday smallint,
  start_time time,
  offered integer,
  booked integer,
  revenue_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_haendler_or_admin();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;

  return query
  with s as (select * from public.settings where id = 1),
  offered as (
    select extract(isodow from g.d)::smallint as wd, t.start_time as st, count(*)::int as n
      from generate_series(p_from, p_to, interval '1 day') g(d)
      cross join s
      join public.slot_templates t
        on t.weekday = extract(isodow from g.d)::smallint and t.active
     where g.d::date between s.season_start and s.season_end
       and not exists (select 1 from public.closed_dates c where c.date = g.d::date)
       and not exists (
         select 1 from public.blocked_slots bs where bs.date = g.d::date and bs.start_time = t.start_time
       )
     group by 1, 2
  ),
  booked as (
    select extract(isodow from b.date)::smallint as wd, b.start_time as st,
           count(*)::int as n, sum(b.amount_total_cents)::bigint as cents
      from public.bookings b
     where b.status = 'paid' and b.date between p_from and p_to
     group by 1, 2
  )
  select coalesce(o.wd, k.wd), coalesce(o.st, k.st), coalesce(o.n, 0), coalesce(k.n, 0),
         case when public.is_admin_aal2() then coalesce(k.cents, 0) end
    from offered o
    full join booked k on k.wd = o.wd and k.st = o.st
   order by 1, 2;
end;
$$;

revoke execute on function public.occupancy_heatmap(date, date) from public, anon;
grant execute on function public.occupancy_heatmap(date, date) to authenticated;
