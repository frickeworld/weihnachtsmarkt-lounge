-- Rabattcodes aus dem Admin (Entscheidung Louis, 05.11.2026), z. B. LOUNGE10: X % auf den Preis,
-- buchbar bis zu einem Datum, optional begrenzte Anzahl Einlösungen, Partys/Heiligabend nur wenn
-- erlaubt. Freiverzehr bleibt immer voll; Händler erhalten den gewohnten Anteil vom rabattierten
-- Lounge-Preis (mindestens den Freiverzehr). Eigene Tabelle, weil Gewinnspiel-Codes nur einmal
-- einlösbar sind (Unique-Index auf bookings.discount_code). Preis rechnet nur der Server.

create table public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{4,24}$'),
  percent integer not null check (percent between 1 and 90),
  valid_from date,
  bookable_until date not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  allow_specials boolean not null default false,
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.promo_codes is
  'Rabattcodes aus dem Admin (mehrfach einlösbar). Gewinnspiel-Codes liegen in discount_codes.';
alter table public.promo_codes enable row level security;
create policy "admin liest promo_codes" on public.promo_codes
  for select to authenticated using (public.is_admin_aal2());
grant select on public.promo_codes to authenticated;

alter table public.bookings
  add column if not exists promo_code text references public.promo_codes (code);
create index if not exists bookings_promo_code on public.bookings (promo_code)
  where promo_code is not null;

-- Gemeinsame Preisprüfung für Gewinnspiel- und Admin-Codes. source: 'giveaway' oder 'promo'.
create function public.code_pricing(p_code text, p_date date, p_start time)
returns table (
  source text,
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
  c public.promo_codes%rowtype;
  p record;
  v_code text := upper(trim(p_code));
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_used integer;
  v_disc integer;
  v_total integer;
begin
  if exists (select 1 from public.discount_codes d where d.code = v_code) then
    return query select 'giveaway'::text, d.* from public.discount_pricing(v_code, p_date, p_start) d;
    return;
  end if;

  select * into s from public.settings where id = 1;
  select * into c from public.promo_codes x where x.code = v_code and x.active;
  if c.code is null then
    return query select 'promo'::text, 'unknown'::text, null::int, null::int, null::int, null::int,
                        null::int, null::int, null::int, null::int;
    return;
  end if;
  select * into p from public.slot_pricing(p_date, p_start);
  if c.valid_from is not null and v_today < c.valid_from then
    return query select 'promo'::text, 'not_yet'::text, c.percent, p.total_cents, 0, p.total_cents,
                        null::int, null::int, null::int, null::int;
    return;
  end if;
  if v_today > c.bookable_until then
    return query select 'promo'::text, 'expired'::text, c.percent, p.total_cents, 0, p.total_cents,
                        null::int, null::int, null::int, null::int;
    return;
  end if;
  if c.max_uses is not null then
    select count(*) into v_used from public.bookings b
     where b.promo_code = c.code and b.status in ('pending', 'paid');
    if v_used >= c.max_uses then
      return query select 'promo'::text, 'used_up'::text, c.percent, p.total_cents, 0,
                          p.total_cents, null::int, null::int, null::int, null::int;
      return;
    end if;
  end if;
  if p.special_title is not null and not c.allow_specials then
    return query select 'promo'::text, 'special'::text, c.percent, p.total_cents, 0, p.total_cents,
                        null::int, null::int, null::int, null::int;
    return;
  end if;

  -- Wie beim Gewinnspiel-Trostpreis: Rabatt nie auf den Freiverzehr, Gebühr bleibt.
  v_disc := least(round(p.total_cents * c.percent / 100.0)::int,
                  greatest(p.total_cents - p.fee_cents - p.taler_cents, 0));
  v_total := p.total_cents - v_disc;
  return query select 'promo'::text, null::text, c.percent, p.total_cents, v_disc, v_total,
                      p.fee_cents, v_total - p.fee_cents, p.taler_cents,
                      greatest(p.taler_cents,
                               ((v_total - p.fee_cents) * (100 - s.studio_share_percent) / 100)::integer);
end;
$$;
revoke execute on function public.code_pricing(text, date, time) from public, anon, authenticated;
grant execute on function public.code_pricing(text, date, time) to service_role;

-- Vorschau im Buchungsformular: jetzt für beide Code-Arten (gleiche Signatur wie bisher).
create or replace function public.preview_discount(p_code text, p_date date, p_start time)
returns table (reason text, percent integer, base_total_cents integer, discount_cents integer, total_cents integer)
language sql
volatile
security definer
set search_path = ''
as $$
  select d.reason, d.percent, d.base_total_cents, d.discount_cents, d.total_cents
    from public.code_pricing(p_code, p_date, p_start) d;
$$;

-- Admin: Code anlegen, (de)aktivieren, Liste mit Einlösungen.
create function public.admin_create_promo_code(
  p_code text, p_percent integer, p_bookable_until date, p_max_uses integer,
  p_allow_specials boolean, p_note text, p_valid_from date default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_code));
begin
  perform public.assert_admin();
  if v_code !~ '^[A-Z0-9-]{4,24}$' then
    raise exception 'Der Code braucht 4–24 Zeichen: Buchstaben, Ziffern oder Bindestrich'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.discount_codes where code = v_code) then
    raise exception 'Diesen Code gibt es schon' using errcode = '23505';
  end if;
  insert into public.promo_codes (code, percent, valid_from, bookable_until, max_uses,
                                  allow_specials, note, created_by)
  values (v_code, p_percent, p_valid_from, p_bookable_until, p_max_uses,
          coalesce(p_allow_specials, false), nullif(trim(p_note), ''), auth.uid());
  return v_code;
end;
$$;

create function public.admin_set_promo_active(p_code text, p_active boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  update public.promo_codes set active = p_active where code = upper(trim(p_code));
  if not found then
    raise exception 'Code nicht gefunden' using errcode = 'P0002';
  end if;
end;
$$;

create function public.admin_promo_codes()
returns table (
  code text, percent integer, valid_from date, bookable_until date, max_uses integer,
  allow_specials boolean, active boolean, note text, created_at timestamptz,
  uses integer, discount_cents bigint, revenue_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
    select c.code, c.percent, c.valid_from, c.bookable_until, c.max_uses, c.allow_specials,
           c.active, c.note, c.created_at,
           count(b.id) filter (where b.status in ('pending', 'paid'))::int,
           coalesce(sum(b.discount_cents) filter (where b.status = 'paid'), 0)::bigint,
           coalesce(sum(b.amount_total_cents) filter (where b.status = 'paid'), 0)::bigint
      from public.promo_codes c
      left join public.bookings b on b.promo_code = c.code
     group by c.code
     order by c.created_at desc;
end;
$$;

revoke execute on function public.admin_create_promo_code(text, integer, date, integer, boolean, text, date) from public, anon;
revoke execute on function public.admin_set_promo_active(text, boolean) from public, anon;
revoke execute on function public.admin_promo_codes() from public, anon;
grant execute on function public.admin_create_promo_code(text, integer, date, integer, boolean, text, date) to authenticated;
grant execute on function public.admin_set_promo_active(text, boolean) to authenticated;
grant execute on function public.admin_promo_codes() to authenticated;
