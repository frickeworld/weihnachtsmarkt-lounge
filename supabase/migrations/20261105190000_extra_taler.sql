-- Extra-Taler (Entscheidung Louis, 05.11.2026): Zu jeder Lounge-Buchung können Gäste zusätzliche
-- Weihnachtsmarkt-Taler dazubuchen (Standard 100, 200 oder 300 Taler, 1 Taler = 1 €).
-- * keine Verarbeitungsgebühr, kein Rabatt (auch nicht mit Rabatt- oder Gewinnspiel-Code)
-- * gehen vollständig an die Händler: haendler_share_cents enthält die Extra-Taler
-- * stehen als eigene Position auf der Stripe-Zahlung bzw. Rechnung
-- * Ticket, Mail und Scanner zeigen die Gesamtzahl der Taler für die Ausgabe am Einlass
-- Dazu: Trostpreis im Gewinnspiel jetzt 10 % (live bereits so eingestellt, hier für Test/Neuaufbau).

update public.settings set giveaway_discount_percent = 10, updated_at = now() where id = 1;

alter table public.settings
  add column if not exists extra_taler_options integer[] not null default '{100,200,300}'
    check (
      cardinality(extra_taler_options) <= 6
      and 0 < all (extra_taler_options)
      and 1000 >= all (extra_taler_options)
    );

grant select (extra_taler_options) on public.settings to authenticated;
grant update (extra_taler_options) on public.settings to authenticated;

alter table public.bookings
  add column if not exists extra_taler_cents integer not null default 0
    check (extra_taler_cents >= 0 and extra_taler_cents <= 100000 and extra_taler_cents % 100 = 0);

comment on column public.bookings.extra_taler_cents is
  'Zusätzlich gebuchte Weihnachtsmarkt-Taler (1 Taler = 100 Cent). In amount_total_cents und haendler_share_cents enthalten.';

-- Auswahl für das Buchungsformular (öffentlich, keine personenbezogenen Daten).
create function public.get_extra_taler_options()
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(s.extra_taler_options, '{}') from public.settings s where s.id = 1;
$$;
revoke execute on function public.get_extra_taler_options() from public;
grant execute on function public.get_extra_taler_options() to anon, authenticated;

-- Beträge beim Anlegen: Extra-Taler kommen ohne Gebühr und ohne Rabatt obendrauf und gehen
-- vollständig an die Händler. Übergebene Beträge (Rabatt, kostenlos) sind immer ohne Extra-Taler.
create or replace function public.bookings_fill_amounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  select * into p from public.slot_pricing(new.date, new.start_time);
  if p.total_cents is null then
    raise exception 'settings fehlt';
  end if;
  new.extra_taler_cents := coalesce(new.extra_taler_cents, 0);
  new.fee_cents := coalesce(new.fee_cents, p.fee_cents);
  new.price_cents := coalesce(new.price_cents, p.total_cents - p.fee_cents);
  new.taler_cents := coalesce(new.taler_cents, p.taler_cents);
  new.haendler_share_cents := coalesce(new.haendler_share_cents, p.haendler_share_cents)
                              + new.extra_taler_cents;
  new.amount_total_cents := coalesce(new.amount_total_cents, new.price_cents + new.fee_cents)
                            + new.extra_taler_cents;
  return new;
end;
$$;

-- Gespeicherte Beträge bleiben unveränderlich – jetzt auch die Extra-Taler.
create or replace function public.bookings_lock_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.price_cents is distinct from old.price_cents
     or new.fee_cents is distinct from old.fee_cents
     or new.taler_cents is distinct from old.taler_cents
     or new.extra_taler_cents is distinct from old.extra_taler_cents
     or new.haendler_share_cents is distinct from old.haendler_share_cents
     or new.amount_total_cents is distinct from old.amount_total_cents then
    raise exception 'Beträge einer Buchung dürfen nicht geändert werden';
  end if;
  return new;
end;
$$;

-- Scanner: Gesamtzahl der Taler für die Ausgabe am Einlass (Freiverzehr + Extra-Taler).
create or replace function public.scanner_booking_json(b public.bookings)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'booking_code', b.booking_code,
    'first_name', b.first_name,
    'last_name', b.last_name,
    'company_name', b.company_name,
    'persons', b.persons,
    'date', b.date,
    'start_time', to_char(b.start_time, 'HH24:MI'),
    'end_time', to_char(b.end_time, 'HH24:MI'),
    'status', b.status,
    'checked_in_at', b.checked_in_at,
    'taler_handed_out_at', b.taler_handed_out_at,
    'taler_count', (coalesce(b.taler_cents, 0) + b.extra_taler_cents) / 100,
    'extra_taler_count', b.extra_taler_cents / 100
  );
$$;

-- Abrechnung: wie bisher, zusätzlich die Extra-Taler je Buchung und in Summe.
create or replace function public.settlement(p_from date, p_to date)
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
    'extra_taler_cents', (select coalesce(sum(extra_taler_cents), 0) from rows),
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
        'extra_taler_cents', r.extra_taler_cents,
        'amount_total_cents', case when v_admin then r.amount_total_cents end
      ) order by r.date, r.start_time), '[]'::jsonb)
      from rows r
    )
  ) into result;
  return result;
end;
$$;

-- Online-Ticket: Taler zum Abholen (Freiverzehr + Extra-Taler). Eigene Funktion, damit
-- get_ticket unverändert bleibt (Rückgabetyp lässt sich nur durch Löschen ändern).
create function public.get_ticket_taler(p_token text)
returns table (taler_count integer, extra_taler_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce(b.taler_cents, 0) + b.extra_taler_cents) / 100, b.extra_taler_cents / 100
    from public.bookings b
   where p_token ~ '^[A-Za-z0-9]{32}$'
     and b.ticket_token = p_token
     and b.status in ('paid', 'cancelled')
   limit 1;
$$;
revoke execute on function public.get_ticket_taler(text) from public;
grant execute on function public.get_ticket_taler(text) to anon, authenticated;
