-- =====================================================================================
-- Phase 7: Händler-Bereich und Abrechnung
-- Händler sehen Kennzahlen, Buchungen ohne Kontaktdaten und die Abrechnung – nur lesend.
-- Admins (aal2) dürfen dieselben Funktionen nutzen (Abrechnung im Admin).
-- =====================================================================================

-- Zugriff: Admin mit 2FA oder Händler. Hat ein Händler 2FA eingerichtet, gilt sie auch hier.
create function public.is_haendler_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin_aal2()
      or (
        public.has_role(auth.uid(), 'haendler')
        and (
          coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          or not exists (
            select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
          )
        )
      );
$$;

create function public.assert_haendler_or_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_haendler_or_admin() then
    raise exception 'Kein Zugriff' using errcode = '42501';
  end if;
end;
$$;

-- Kennzahlen für Händler: wie im Admin, aber ohne Umsatz und Studio-F-Anteil („Euer Anteil“).
create function public.haendler_dashboard(p_from date, p_to date)
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
      from days
      cross join s
      join public.slot_templates t on t.weekday = extract(isodow from days.d)::smallint and t.active
     where days.d between s.season_start and s.season_end
       and not exists (select 1 from public.closed_dates c where c.date = days.d)
       and not exists (select 1 from public.blocked_slots bs where bs.date = days.d and bs.start_time = t.start_time)
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

-- Buchungsliste ohne E-Mail, Telefon, Adresse, Wünsche und USt-ID.
create function public.haendler_bookings(p_from date, p_to date)
returns table (
  id uuid,
  booking_code text,
  slot_date date,
  start_time time,
  end_time time,
  first_name text,
  last_name text,
  company_name text,
  persons integer,
  occasion text,
  status text,
  checked_in_at timestamptz,
  taler_handed_out_at timestamptz,
  no_show boolean,
  include_in_settlement boolean,
  haendler_share_cents integer
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
  select b.id, b.booking_code, b.date, b.start_time, b.end_time, b.first_name, b.last_name,
         b.company_name, b.persons, b.occasion, b.status, b.checked_in_at, b.taler_handed_out_at,
         (b.status = 'paid' and b.checked_in_at is null
           and ((b.date + b.end_time) at time zone 'Europe/Berlin') < now()),
         b.include_in_settlement, b.haendler_share_cents
    from public.bookings b
   where b.date between p_from and p_to
     and b.status in ('paid', 'cancelled')
   order by b.date, b.start_time;
end;
$$;

-- Abrechnung: bezahlte Buchungen mit include_in_settlement – auch ohne Erscheinen, ohne Stornos.
-- Gesamtbetrag und Studio-F-Anteil nur für Admins.
create function public.settlement(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin_aal2();
  result jsonb;
begin
  perform public.assert_haendler_or_admin();
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;

  with rows as (
    select b.*
      from public.bookings b
     where b.date between p_from and p_to
       and b.status = 'paid'
       and b.include_in_settlement
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'count', (select count(*) from rows),
    'haendler_cents', (select coalesce(sum(haendler_share_cents), 0) from rows),
    'revenue_cents', case when v_admin then (select coalesce(sum(amount_total_cents), 0) from rows) end,
    'studio_cents', case when v_admin
      then (select coalesce(sum(amount_total_cents - haendler_share_cents), 0) from rows) end,
    'no_shows', (
      select count(*) from rows
       where checked_in_at is null and ((date + end_time) at time zone 'Europe/Berlin') < now()
    ),
    'excluded_cancelled', (
      select count(*) from public.bookings where date between p_from and p_to and status = 'cancelled'
    ),
    'excluded_not_in_settlement', (
      select count(*) from public.bookings
       where date between p_from and p_to and status = 'paid' and not include_in_settlement
    ),
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', r.date,
        'start_time', to_char(r.start_time, 'HH24:MI'),
        'end_time', to_char(r.end_time, 'HH24:MI'),
        'booking_code', r.booking_code,
        'name', r.first_name || ' ' || r.last_name,
        'company_name', r.company_name,
        'persons', r.persons,
        'source', r.source,
        'checked_in', r.checked_in_at is not null,
        'haendler_share_cents', r.haendler_share_cents,
        'amount_total_cents', case when v_admin then r.amount_total_cents end
      ) order by r.date, r.start_time), '[]'::jsonb)
      from rows r
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.is_haendler_or_admin() from public, anon;
revoke execute on function public.assert_haendler_or_admin() from public, anon, authenticated;
revoke execute on function public.haendler_dashboard(date, date) from public, anon;
revoke execute on function public.haendler_bookings(date, date) from public, anon;
revoke execute on function public.settlement(date, date) from public, anon;
grant execute on function public.is_haendler_or_admin() to authenticated;
grant execute on function public.haendler_dashboard(date, date) to authenticated;
grant execute on function public.haendler_bookings(date, date) to authenticated;
grant execute on function public.settlement(date, date) to authenticated;
