-- Aufruf-Tracker im Admin (Entscheidung Louis, 10.11.2026): Seitenaufrufe mit Herkunft und Seite,
-- weiterhin ohne Cookies, ohne IDs, ohne IP und ohne User-Agent.
-- * source: woher der Besuch kommt – utm_source aus dem Link oder die Domain des Verweises,
--   grob zusammengefasst (instagram, facebook, google, weihnachtsmarkt-detmold.de …), sonst „direkt“
-- * page:   welche Seite (start, gewinnspiel)

alter table public.page_events
  add column if not exists source text check (source is null or source ~ '^[a-z0-9._-]{1,40}$'),
  add column if not exists page text check (page is null or page ~ '^[a-z0-9-]{1,30}$');

grant select (source, page) on public.page_events to authenticated;

-- Seitenaufruf mit Herkunft. Unbekannte Werte werden verworfen statt gespeichert.
create function public.track_page_view(p_device text, p_page text, p_source text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_source text := lower(left(trim(coalesce(p_source, '')), 40));
  v_page text := lower(left(trim(coalesce(p_page, '')), 30));
begin
  if p_device not in ('mobile', 'desktop') then
    raise exception 'Ungültiges Event' using errcode = '22023';
  end if;
  if v_source !~ '^[a-z0-9._-]{1,40}$' then v_source := 'direkt'; end if;
  if v_page !~ '^[a-z0-9-]{1,30}$' then v_page := null; end if;
  insert into public.page_events (event_type, device, source, page)
  values ('page_view', p_device, v_source, v_page);
end;
$$;
revoke execute on function public.track_page_view(text, text, text) from public;
grant execute on function public.track_page_view(text, text, text) to anon, authenticated;

-- Auswertung für den Admin: Herkunft, Seiten, Geräte, Uhrzeit (Berlin), heute und letzte Stunde.
create function public.admin_traffic(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.assert_admin();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;

  with ev as (
    select e.*, (e.created_at at time zone 'Europe/Berlin') as local_at
      from public.page_events e
     where e.event_type = 'page_view'
       and (e.created_at at time zone 'Europe/Berlin')::date between p_from and p_to
  )
  select jsonb_build_object(
    'page_views', (select count(*) from ev),
    'today', (
      select count(*) from public.page_events
       where event_type = 'page_view'
         and (created_at at time zone 'Europe/Berlin')::date = (now() at time zone 'Europe/Berlin')::date
    ),
    'last_hour', (
      select count(*) from public.page_events
       where event_type = 'page_view' and created_at > now() - interval '1 hour'
    ),
    'by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'count', c) order by c desc, k), '[]'::jsonb)
        from (select coalesce(source, 'unbekannt') k, count(*) c from ev group by 1) x
    ),
    'by_page', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'count', c) order by c desc, k), '[]'::jsonb)
        from (select coalesce(page, 'start') k, count(*) c from ev group by 1) x
    ),
    'by_device', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'count', c) order by c desc, k), '[]'::jsonb)
        from (select device k, count(*) c from ev group by 1) x
    ),
    'by_hour', (
      select jsonb_agg(jsonb_build_object('hour', h, 'count',
               (select count(*) from ev where extract(hour from ev.local_at) = h)) order by h)
        from generate_series(0, 23) h
    )
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_traffic(date, date) from public, anon;
grant execute on function public.admin_traffic(date, date) to authenticated;
