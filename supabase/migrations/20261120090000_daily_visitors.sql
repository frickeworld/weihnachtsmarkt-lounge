-- Besucher pro Tag (Entscheidung Louis, 20.11.2026): Wie viele Menschen kommen täglich auf die
-- Website – nicht nur Seitenaufrufe. Datensparsam wie bei Plausible/Matomo ohne Cookies:
-- * aus IP-Adresse + Browser-Kennung + einem täglich neuen Zufallswert wird ein kurzer Hash gebildet
-- * gespeichert wird nur dieser Hash, nie die IP-Adresse
-- * der Zufallswert wird nach einem Tag gelöscht – danach lässt sich niemand mehr zuordnen, auch
--   nicht über mehrere Tage hinweg
-- * nichts wird auf dem Gerät gespeichert (keine Cookies, kein localStorage)

create table public.visitor_salts (
  day date primary key,
  salt bytea not null default extensions.gen_random_bytes(32)
);
comment on table public.visitor_salts is
  'Täglicher Zufallswert für den Besucher-Hash; wird nach einem Tag gelöscht.';
alter table public.visitor_salts enable row level security;
revoke all on public.visitor_salts from public, anon, authenticated;

alter table public.page_events
  add column if not exists visitor text check (visitor is null or visitor ~ '^[0-9a-f]{16}$');
grant select (visitor) on public.page_events to authenticated;

create or replace function public.track_page_view(p_device text, p_page text, p_source text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_source text := lower(left(trim(coalesce(p_source, '')), 40));
  v_page text := lower(left(trim(coalesce(p_page, '')), 30));
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  v_ua text := coalesce(v_headers ->> 'user-agent', '');
  v_salt bytea;
  v_visitor text;
begin
  if p_device not in ('mobile', 'desktop') then
    raise exception 'Ungültiges Event' using errcode = '22023';
  end if;
  if v_source !~ '^[a-z0-9._-]{1,40}$' then v_source := 'direkt'; end if;
  if v_page !~ '^[a-z0-9-]{1,30}$' then v_page := null; end if;

  if v_ip is not null then
    insert into public.visitor_salts (day) values (v_today) on conflict (day) do nothing;
    delete from public.visitor_salts where day < v_today;
    select s.salt into v_salt from public.visitor_salts s where s.day = v_today;
    v_visitor := left(encode(extensions.digest(
      convert_to(v_ip || '|' || v_ua, 'UTF8') || v_salt, 'sha256'), 'hex'), 16);
  end if;

  insert into public.page_events (event_type, device, source, page, visitor)
  values ('page_view', p_device, v_source, v_page, v_visitor);
end;
$$;

-- Auswertung: wie bisher, dazu Besucher (je Tag eindeutig) und eine Tagesreihe.
create or replace function public.admin_traffic(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  perform public.assert_admin();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;

  with ev as (
    select e.*, (e.created_at at time zone 'Europe/Berlin') as local_at,
           (e.created_at at time zone 'Europe/Berlin')::date as d
      from public.page_events e
     where e.event_type = 'page_view'
       and (e.created_at at time zone 'Europe/Berlin')::date between p_from and p_to
  ),
  per_day as (
    -- Besucher je Tag: eindeutige Hashes; Aufrufe ohne Hash (vor dem 20.11.) zählen einzeln
    select d, count(*) as views,
           count(distinct visitor) + count(*) filter (where visitor is null) as visitors
      from ev group by d
  )
  select jsonb_build_object(
    'page_views', (select count(*) from ev),
    'visitors', (select coalesce(sum(visitors), 0) from per_day),
    'today', (
      select count(*) from public.page_events
       where event_type = 'page_view'
         and (created_at at time zone 'Europe/Berlin')::date = v_today
    ),
    'visitors_today', (
      select count(distinct visitor) + count(*) filter (where visitor is null)
        from public.page_events
       where event_type = 'page_view'
         and (created_at at time zone 'Europe/Berlin')::date = v_today
    ),
    'last_hour', (
      select count(*) from public.page_events
       where event_type = 'page_view' and created_at > now() - interval '1 hour'
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', g.d::date,
               'page_views', coalesce(p.views, 0),
               'visitors', coalesce(p.visitors, 0)) order by g.d), '[]'::jsonb)
        from generate_series(p_from, p_to, interval '1 day') g(d)
        left join per_day p on p.d = g.d::date
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
