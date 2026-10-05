-- =====================================================================================
-- Preise und Freiverzehr je Zeitfenster (Vorschlag Oliver, 05.10.2026)
--
-- Endpreis = was der Gast zahlt (inkl. Vorverkaufsgebühr settings.fee_cents, die bei Studio F
-- bleibt). Händler-Anteil = Freiverzehr + Hälfte des Rests (Endpreis − Gebühr − Freiverzehr),
-- je Vorlage oder Sondertermin überschreibbar. Sondertermine (Partys, Auftritte) überschreiben
-- Preis und Freiverzehr für ein einzelnes Datum/Zeitfenster.
-- Bestehende Buchungen behalten ihre gespeicherten Beträge. Nur additiv.
-- =====================================================================================

alter table public.slot_templates
  add column if not exists price_cents integer check (price_cents is null or price_cents > 0),
  add column if not exists taler_count integer check (taler_count is null or taler_count >= 0),
  add column if not exists haendler_share_cents integer
    check (haendler_share_cents is null or haendler_share_cents >= 0),
  add column if not exists label text;

comment on column public.slot_templates.price_cents is
  'Endpreis inkl. Vorverkaufsgebühr. null = alter Standard aus settings.';

create table public.slot_specials (
  date date not null,
  start_time time not null,
  title text not null check (length(trim(title)) between 1 and 80),
  price_cents integer not null check (price_cents > 0),
  taler_count integer not null check (taler_count >= 0),
  haendler_share_cents integer check (haendler_share_cents is null or haendler_share_cents >= 0),
  created_at timestamptz not null default now(),
  primary key (date, start_time)
);
comment on table public.slot_specials is 'Sonderpreise für einzelne Termine (z. B. Party-Abende).';

alter table public.slot_specials enable row level security;
revoke all on public.slot_specials from anon, authenticated;
grant select, insert, update, delete on public.slot_specials to authenticated;
create policy "admin verwaltet slot_specials" on public.slot_specials
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());

-- Preis eines Zeitfensters: Sondertermin → Vorlage → alter Standard (settings).
create function public.slot_pricing(p_date date, p_start time)
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
  v_total integer;
  v_taler integer;
  v_share integer;
begin
  select * into s from public.settings where id = 1;
  select * into sp from public.slot_specials x where x.date = p_date and x.start_time = p_start;
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
                        s.haendler_share_cents, null::text, t.label;
    return;
  end if;

  if v_share is null then
    v_share := v_taler * 100 + greatest(v_total - s.fee_cents - v_taler * 100, 0) / 2;
  end if;
  return query select v_total, s.fee_cents, v_taler, v_taler * 100, v_share, sp.title, t.label;
end;
$$;

-- Beträge beim Anlegen aus dem Preis des Zeitfensters (statt nur aus settings).
-- Vom Client kommen weiterhin nie Preise; explizit gesetzte Werte (z. B. kostenlos = 0) bleiben.
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
  new.fee_cents := coalesce(new.fee_cents, p.fee_cents);
  new.price_cents := coalesce(new.price_cents, p.total_cents - p.fee_cents);
  new.taler_cents := coalesce(new.taler_cents, p.taler_cents);
  new.haendler_share_cents := coalesce(new.haendler_share_cents, p.haendler_share_cents);
  new.amount_total_cents := coalesce(new.amount_total_cents, new.price_cents + new.fee_cents);
  return new;
end;
$$;

-- Verfügbarkeit mit Preis je Zeitfenster (für Kalender und Formular).
create function public.get_availability_priced(from_date date, to_date date)
returns table (
  slot_date date,
  start_time time,
  end_time time,
  status text,
  total_cents integer,
  taler_count integer,
  special_title text,
  label text
)
language sql
volatile
security definer
set search_path = ''
as $$
  select a.slot_date, a.start_time, a.end_time, a.status,
         p.total_cents, p.taler_count, p.special_title, p.label
    from public.get_availability(from_date, to_date) a
    cross join lateral public.slot_pricing(a.slot_date, a.start_time) p;
$$;

-- Preisübersicht für die Website (aktive Vorlagen).
create function public.get_price_list()
returns table (
  weekday smallint,
  start_time time,
  end_time time,
  total_cents integer,
  taler_count integer,
  label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.weekday, t.start_time, t.end_time,
         coalesce(t.price_cents, s.price_cents + s.fee_cents),
         coalesce(t.taler_count, s.taler_count),
         t.label
    from public.slot_templates t
    cross join public.settings s
   where t.active and s.id = 1
   order by t.weekday, t.start_time;
$$;

revoke execute on function public.slot_pricing(date, time) from public, anon, authenticated;
revoke execute on function public.get_availability_priced(date, date) from public;
revoke execute on function public.get_price_list() from public;
grant execute on function public.get_availability_priced(date, date) to anon, authenticated;
grant execute on function public.get_price_list() to anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Neue Zeiten und Preise. Alte Vorlagen werden nur deaktiviert (bestehende Buchungen bleiben).
--   Mo–Do: 14:30 Nachmittag 99 € (50 € Freiverzehr), 16:45 und 19:00 Abend 149 € (75 €)
--   So:    14:30 Nachmittag 149 € (75 €), 16:45 und 19:00 Abend 149 € (75 €)
--   Fr–Sa: 15:30 Nachmittag 149 € (75 €), 17:45 und 20:00 Abend 199 € (100 €)
-- -------------------------------------------------------------------------------------
update public.slot_templates set active = false where price_cents is null;

insert into public.slot_templates (weekday, start_time, end_time, active, price_cents, taler_count, label)
select wd, v.st::time, v.et::time, true, v.price, v.taler, v.label
  from (values
    (1), (2), (3), (4)
  ) d(wd),
  (values
    ('14:30', '16:30', 9900, 50, 'Nachmittag'),
    ('16:45', '18:45', 14900, 75, 'Abend'),
    ('19:00', '21:00', 14900, 75, 'Abend')
  ) v(st, et, price, taler, label)
union all
select 7, v.st::time, v.et::time, true, v.price, v.taler, v.label
  from (values
    ('14:30', '16:30', 14900, 75, 'Nachmittag'),
    ('16:45', '18:45', 14900, 75, 'Abend'),
    ('19:00', '21:00', 14900, 75, 'Abend')
  ) v(st, et, price, taler, label)
union all
select wd, v.st::time, v.et::time, true, v.price, v.taler, v.label
  from (values (5), (6)) d(wd),
  (values
    ('15:30', '17:30', 14900, 75, 'Nachmittag'),
    ('17:45', '19:45', 19900, 100, 'Abend'),
    ('20:00', '22:00', 19900, 100, 'Abend')
  ) v(st, et, price, taler, label)
on conflict (weekday, start_time) do update
  set end_time = excluded.end_time, active = true, price_cents = excluded.price_cents,
      taler_count = excluded.taler_count, label = excluded.label;
