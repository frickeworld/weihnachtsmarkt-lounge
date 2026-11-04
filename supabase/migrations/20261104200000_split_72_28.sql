-- =====================================================================================
-- Neue Aufteilung (Entscheidung Louis, 04.11.2026), nur additiv:
-- STUDIO/F bzw. MF Coaching bekommt 28 % vom Lounge-Preis plus die Verarbeitungsgebühr (5 %),
-- die Händler bekommen die übrigen 72 % vom Lounge-Preis – darin immer mindestens der volle
-- Freiverzehr. Beispiel Fr/Sa-Abend: Lounge 199 € + 9,95 € Gebühr = 208,95 € →
-- Händler 143,28 €, Studio F 55,72 € + 9,95 € = 65,67 €.
-- Händler-Anteile: 71,28 € (99 €) / 107,28 € (149 €) / 143,28 € (199 €) / 136,08 € (Party 189 €) /
-- 215,28 € (Heiligabend 299 €). Rabatt-Code: 72 % vom rabattierten Lounge-Preis (mindestens der
-- Freiverzehr). Gewinn-Code (100 %) unverändert: Händler halber Freiverzehr.
-- Bestehende Buchungen behalten ihre kopierten Beträge; Überschreibungen je Preisstufe/Sondertermin
-- (haendler_share_cents gesetzt) gelten weiter.
-- =====================================================================================

alter table public.settings
  add column if not exists studio_share_percent numeric(5, 2) not null default 28
    check (studio_share_percent >= 0 and studio_share_percent <= 100);
comment on column public.settings.studio_share_percent is
  'Anteil von STUDIO/F am Lounge-Preis (ohne Gebühr) in Prozent; Händler bekommen den Rest, mindestens den Freiverzehr.';

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
  v_fee integer;
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

  v_fee := public.slot_fee(v_total);
  if v_share is null then
    -- Händler: 100 − studio_share_percent (72 %) vom Lounge-Preis, mindestens der Freiverzehr
    v_share := greatest(v_taler * 100,
                        ((v_total - v_fee) * (100 - s.studio_share_percent) / 100)::integer);
  end if;
  return query select v_total, v_fee, v_taler, v_taler * 100, v_share, sp.title,
                      coalesce(e.label, t.label);
end;
$$;
revoke execute on function public.slot_pricing(date, time) from public, anon, authenticated;

create or replace function public.discount_pricing(p_code text, p_date date, p_start time)
returns table (
  reason text,
  percent integer,
  base_total_cents integer,
  discount_cents integer,
  total_cents integer,
  fee_cents integer,
  price_cents integer,
  taler_cents integer,
  haendler_share_cents integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  s public.settings%rowtype;
  c public.discount_codes%rowtype;
  p record;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_disc integer;
  v_total integer;
begin
  select * into s from public.settings where id = 1;
  select * into c from public.discount_codes x where x.code = upper(trim(p_code));
  if c.code is null then
    return query select 'unknown'::text, null::int, null::int, null::int, null::int, null::int, null::int, null::int, null::int;
    return;
  end if;
  select * into p from public.slot_pricing(p_date, p_start);
  if v_today > c.valid_until or p_date > c.valid_until
     or (c.redeem_by is not null and now() > c.redeem_by) then
    return query select 'expired'::text, c.percent, p.total_cents, 0, p.total_cents, null::int, null::int, null::int, null::int;
    return;
  end if;
  if exists (
    select 1 from public.bookings b
     where b.discount_code = c.code and b.status in ('pending', 'paid')
  ) then
    return query select 'used'::text, c.percent, p.total_cents, 0, p.total_cents, null::int, null::int, null::int, null::int;
    return;
  end if;
  if c.weekdays is not null and not (extract(isodow from p_date)::smallint = any (c.weekdays)) then
    return query select 'weekday'::text, c.percent, p.total_cents, 0, p.total_cents, null::int, null::int, null::int, null::int;
    return;
  end if;
  if p.special_title is not null and not c.allow_specials then
    return query select 'special'::text, c.percent, p.total_cents, 0, p.total_cents, null::int, null::int, null::int, null::int;
    return;
  end if;

  if c.percent = 100 then
    return query select null::text, 100, p.total_cents, p.total_cents, 0, 0, 0, p.taler_cents,
                        p.taler_cents / 2;
    return;
  end if;
  -- Rabatt nur auf den Teil ohne Gebühr und Freiverzehr (Freiverzehr bleibt immer voll).
  v_disc := least(round(p.total_cents * c.percent / 100.0)::int,
                  greatest(p.total_cents - p.fee_cents - p.taler_cents, 0));
  v_total := p.total_cents - v_disc;
  -- Händler: 72 % vom rabattierten Lounge-Preis, mindestens der Freiverzehr
  return query select null::text, c.percent, p.total_cents, v_disc, v_total, p.fee_cents,
                      v_total - p.fee_cents, p.taler_cents,
                      greatest(p.taler_cents,
                               ((v_total - p.fee_cents) * (100 - s.studio_share_percent) / 100)::integer);
end;
$$;
revoke execute on function public.discount_pricing(text, date, time) from public, anon, authenticated;
