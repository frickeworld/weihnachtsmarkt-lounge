-- =====================================================================================
-- Verkaufsgebühr 5 % statt 3,50 € fest (Entscheidung Louis, 04.11.2026), nur additiv.
--
-- Bisherige Preise (99/149/199/189/299 €) sind jetzt der Lounge-Preis ohne Gebühr. Endpreis =
-- Lounge-Preis + 5 %, auf volle Euro gerundet: 104 / 156 / 209 / 198 / 314 €.
-- Gebühr je Zeitfenster = Endpreis − Lounge-Preis (Lounge-Preis = Endpreis ÷ 1,05, auf volle
-- Euro gerundet). Die Gebühr bleibt bei Studio F; Händler-Anteil = Freiverzehr + Hälfte von
-- (Endpreis − Gebühr − Freiverzehr). Bestehende Buchungen behalten ihre Beträge.
-- settings.fee_percent leer = alte feste Gebühr settings.fee_cents.
-- =====================================================================================

alter table public.settings
  add column if not exists fee_percent numeric(5, 2)
    check (fee_percent is null or (fee_percent >= 0 and fee_percent <= 30));
comment on column public.settings.fee_percent is
  'Verkaufsgebühr in Prozent auf den Lounge-Preis (Endpreis auf volle Euro gerundet). Leer = fee_cents fest.';

-- Gebühr, die in einem Endpreis steckt
create function public.slot_fee(p_total integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when s.fee_percent is null then s.fee_cents
           else p_total - (round(p_total / (1 + s.fee_percent / 100) / 100) * 100)::integer
         end
    from public.settings s
   where s.id = 1;
$$;
revoke execute on function public.slot_fee(integer) from public, anon, authenticated;

-- Öffentlich: Prozentsatz für die Anzeige („inkl. 5 % Vorverkaufsgebühr“)
create function public.get_fee_info()
returns table (fee_percent numeric, fee_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.fee_percent, s.fee_cents from public.settings s where s.id = 1;
$$;
revoke execute on function public.get_fee_info() from public;
grant execute on function public.get_fee_info() to anon, authenticated;

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
    v_share := v_taler * 100 + greatest(v_total - v_fee - v_taler * 100, 0) / 2;
  end if;
  return query select v_total, v_fee, v_taler, v_taler * 100, v_share, sp.title,
                      coalesce(e.label, t.label);
end;
$$;
revoke execute on function public.slot_pricing(date, time) from public, anon, authenticated;

-- Neue Endpreise: bisheriger Preis + 5 %, auf volle Euro gerundet
update public.settings set fee_percent = 5, updated_at = now() where id = 1 and fee_percent is null;

update public.slot_templates
   set price_cents = (round(price_cents * 1.05 / 100) * 100)::integer
 where price_cents is not null;

update public.slot_specials
   set price_cents = (round(price_cents * 1.05 / 100) * 100)::integer;
