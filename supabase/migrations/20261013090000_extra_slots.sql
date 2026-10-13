-- =====================================================================================
-- Einmalige Zeitfenster (Entscheidung Louis, 13.10.2026), nur additiv.
--
-- Für Tage mit besonderen Zeiten, z. B. Heiligabend 10:00–13:00 oder 26.12. 13:00 und 16:00.
-- replaces_regular = true: An diesem Tag gelten nur die einmaligen Zeitfenster, die Vorlagen
-- des Wochentags fallen weg. Preis und Freiverzehr kommen wie gewohnt aus slot_specials.
-- Saison, Schließtage, Sperren und Buchungsschluss gelten auch hier.
-- =====================================================================================

create table public.extra_slots (
  date date not null,
  start_time time not null,
  end_time time not null,
  label text check (label is null or char_length(label) between 1 and 40),
  replaces_regular boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (date, start_time),
  constraint extra_slot_order check (start_time < end_time)
);
comment on table public.extra_slots is
  'Einmalige Zeitfenster an einzelnen Tagen. Preis über slot_specials.';
comment on column public.extra_slots.replaces_regular is
  'true = Vorlagen des Wochentags gelten an diesem Tag nicht';

alter table public.extra_slots enable row level security;
revoke all on public.extra_slots from anon, authenticated;
grant select, insert, update, delete on public.extra_slots to authenticated;
create policy "admin verwaltet extra_slots" on public.extra_slots
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());

-- Alle angebotenen Zeitfenster eines Zeitraums: Vorlagen + einmalige Zeitfenster.
-- Ohne Saison/Schließtag/Sperre – das prüfen die Aufrufer.
create function public.slot_grid(p_from date, p_to date)
returns table (slot_date date, start_time time, end_time time)
language sql
stable
security definer
set search_path = ''
as $$
  select days.d, t.start_time, t.end_time
    from (select g::date as d from generate_series(p_from, p_to, interval '1 day') g) days
    join public.slot_templates t
      on t.weekday = extract(isodow from days.d)::smallint and t.active
   where not exists (
     select 1 from public.extra_slots e
      where e.date = days.d and (e.replaces_regular or e.start_time = t.start_time)
   )
  union all
  select e.date, e.start_time, e.end_time
    from public.extra_slots e
   where e.date between p_from and p_to;
$$;
revoke execute on function public.slot_grid(date, date) from public, anon, authenticated;

-- Verfügbarkeit: wie bisher, aber auf Basis von slot_grid.
create or replace function public.get_availability(from_date date, to_date date)
returns table (
  slot_date date,
  start_time time,
  end_time time,
  status text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if from_date is null or to_date is null or to_date < from_date then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;
  if to_date - from_date > 62 then
    raise exception 'Zeitraum zu lang (max. 62 Tage)' using errcode = '22023';
  end if;

  perform public.expire_stale_holds();

  return query
  with s as (select * from public.settings where id = 1)
  select
    g.slot_date,
    g.start_time,
    g.end_time,
    case
      when g.slot_date < s.season_start or g.slot_date > s.season_end then 'out_of_season'
      when exists (select 1 from public.closed_dates c where c.date = g.slot_date) then 'closed'
      when public.slot_starts_at(g.slot_date, g.start_time)
           - make_interval(mins => s.booking_cutoff_minutes) <= now() then 'past'
      when exists (
        select 1 from public.bookings b
         where b.date = g.slot_date and b.start_time = g.start_time
           and b.status in ('pending', 'paid')
      ) then 'taken'
      when exists (
        select 1 from public.blocked_slots bs
         where bs.date = g.slot_date and bs.start_time = g.start_time
      ) then 'blocked'
      else 'free'
    end
  from public.slot_grid(from_date, to_date) g
  cross join s
  order by g.slot_date, g.start_time;
end;
$$;

-- Preis: unverändert, nur die Bezeichnung kommt bei einmaligen Zeitfenstern aus extra_slots.
create or replace function public.slot_pricing(p_date date, p_start time)
returns table (
  total_cents integer,
  fee_cents integer,
  taler_count integer,
  taler_cents integer,
  haendler_share_cents integer,
  special_title text,
  label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.settings%rowtype;
  t public.slot_templates%rowtype;
  sp public.slot_specials%rowtype;
  e public.extra_slots%rowtype;
  v_total integer;
  v_taler integer;
  v_share integer;
begin
  select * into s from public.settings where id = 1;
  select * into sp from public.slot_specials x where x.date = p_date and x.start_time = p_start;
  select * into e from public.extra_slots x where x.date = p_date and x.start_time = p_start;
  select * into t from public.slot_templates x
   where x.weekday = extract(isodow from p_date)::smallint and x.start_time = p_start
   order by x.active desc
   limit 1;

  if sp.date is not null then
    v_total := sp.price_cents;
    v_taler := sp.taler_count;
    v_share := sp.haendler_share_cents;
  elsif t.price_cents is not null then
    v_total := t.price_cents;
    v_taler := coalesce(t.taler_count, s.taler_count);
    v_share := t.haendler_share_cents;
  else
    -- Alter Standard (vor der Preisstaffel): Preis + Gebühr, fester Händler-Anteil
    return query select s.price_cents + s.fee_cents, s.fee_cents, s.taler_count, s.taler_cents,
                        s.haendler_share_cents, null::text, coalesce(e.label, t.label);
    return;
  end if;

  if v_share is null then
    v_share := v_taler * 100 + greatest(v_total - s.fee_cents - v_taler * 100, 0) / 2;
  end if;
  return query select v_total, s.fee_cents, v_taler, v_taler * 100, v_share, sp.title,
                      coalesce(e.label, t.label);
end;
$$;
revoke execute on function public.slot_pricing(date, time) from public, anon, authenticated;

-- Kennzahl „verfügbare Zeitfenster“ in den Dashboards zählt einmalige Zeitfenster mit.
create or replace function public.admin_dashboard(p_from date, p_to date)
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

  with s as (select * from public.settings where id = 1),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') g(d)),
  ev as (
    select event_type, (created_at at time zone 'Europe/Berlin')::date as d
      from public.page_events
     where (created_at at time zone 'Europe/Berlin')::date between p_from and p_to
  ),
  b as (select * from public.bookings where date between p_from and p_to),
  paid as (select * from b where status = 'paid'),
  online_paid_in_period as (
    select (paid_at at time zone 'Europe/Berlin')::date as d
      from public.bookings
     where status = 'paid' and source = 'online'
       and (paid_at at time zone 'Europe/Berlin')::date between p_from and p_to
  ),
  available as (
    select count(*) as n
      from public.slot_grid(p_from, p_to) g
      cross join s
     where g.slot_date between s.season_start and s.season_end
       and not exists (select 1 from public.closed_dates c where c.date = g.slot_date)
       and not exists (select 1 from public.blocked_slots bs where bs.date = g.slot_date and bs.start_time = g.start_time)
  )
  select jsonb_build_object(
    'page_views', (select count(*) from ev where event_type = 'page_view'),
    'book_clicks', (select count(*) from ev where event_type = 'book_click'),
    'paid_bookings', (select count(*) from paid),
    'online_paid_in_period', (select count(*) from online_paid_in_period),
    'available_slots', (select n from available),
    'revenue_cents', (select coalesce(sum(amount_total_cents), 0) from paid),
    'haendler_cents', (select coalesce(sum(haendler_share_cents), 0) from paid where include_in_settlement),
    'checked_in', (select count(*) from paid where checked_in_at is not null),
    'no_shows', (
      select count(*) from paid
       where checked_in_at is null
         and ((date + end_time) at time zone 'Europe/Berlin') < now()
    ),
    'taler_handed_out', (select count(*) from paid where taler_handed_out_at is not null),
    'pending', (select count(*) from b where status = 'pending'),
    'cancelled', (select count(*) from b where status = 'cancelled'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', days.d,
        'page_views', (select count(*) from ev where ev.d = days.d and event_type = 'page_view'),
        'book_clicks', (select count(*) from ev where ev.d = days.d and event_type = 'book_click'),
        'bookings', (select count(*) from online_paid_in_period o where o.d = days.d)
      ) order by days.d), '[]'::jsonb)
      from days
    )
  ) into result;

  -- Studio-F-Anteil = Umsatz − Händler-Anteil (CLAUDE.md)
  return result || jsonb_build_object(
    'studio_cents', (result ->> 'revenue_cents')::bigint - (result ->> 'haendler_cents')::bigint
  );
end;
$$;

create or replace function public.haendler_dashboard(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.assert_haendler_or_admin();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;

  with s as (select * from public.settings where id = 1),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') g(d)),
  ev as (
    select event_type, (created_at at time zone 'Europe/Berlin')::date as d
      from public.page_events
     where (created_at at time zone 'Europe/Berlin')::date between p_from and p_to
  ),
  b as (select * from public.bookings where date between p_from and p_to),
  paid as (select * from b where status = 'paid'),
  online_paid_in_period as (
    select (paid_at at time zone 'Europe/Berlin')::date as d
      from public.bookings
     where status = 'paid' and source = 'online'
       and (paid_at at time zone 'Europe/Berlin')::date between p_from and p_to
  ),
  available as (
    select count(*) as n
      from public.slot_grid(p_from, p_to) g
      cross join s
     where g.slot_date between s.season_start and s.season_end
       and not exists (select 1 from public.closed_dates c where c.date = g.slot_date)
       and not exists (select 1 from public.blocked_slots bs where bs.date = g.slot_date and bs.start_time = g.start_time)
  )
  select jsonb_build_object(
    'page_views', (select count(*) from ev where event_type = 'page_view'),
    'book_clicks', (select count(*) from ev where event_type = 'book_click'),
    'paid_bookings', (select count(*) from paid),
    'online_paid_in_period', (select count(*) from online_paid_in_period),
    'available_slots', (select n from available),
    'haendler_cents', (select coalesce(sum(haendler_share_cents), 0) from paid where include_in_settlement),
    'checked_in', (select count(*) from paid where checked_in_at is not null),
    'no_shows', (
      select count(*) from paid
       where checked_in_at is null
         and ((date + end_time) at time zone 'Europe/Berlin') < now()
    ),
    'taler_handed_out', (select count(*) from paid where taler_handed_out_at is not null),
    'cancelled', (select count(*) from b where status = 'cancelled'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', days.d,
        'page_views', (select count(*) from ev where ev.d = days.d and event_type = 'page_view'),
        'book_clicks', (select count(*) from ev where ev.d = days.d and event_type = 'book_click'),
        'bookings', (select count(*) from online_paid_in_period o where o.d = days.d)
      ) order by days.d), '[]'::jsonb)
      from days
    )
  ) into result;
  return result;
end;
$$;
