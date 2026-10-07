-- Gewinnspiel „Jede Woche einen Abend gewinnen“ + persönliche Codes (additiv).
-- Entscheidung Louis (07.10.2026): Veranstalter Die Händler e. V.; Teilnahme = Newsletter
-- (eigenes Double-Opt-in); wöchentliche Ziehung per Knopf im Admin; Gewinner bekommt einen
-- 100-%-Code für einen freien Abend seiner Wahl (keine Sonderveranstaltungen); alle anderen nach
-- jeder Ziehung einen persönlichen Trostpreis-Code (Standard 30 %, nur Mo–Do, bis Saisonende).
-- Rabatt: Freiverzehr bleibt voll, der Rest wird wie gewohnt halbiert. Gewinn: Taler tragen
-- Händler und Studio F je zur Hälfte (Händler-Anteil = halber Freiverzehr, Betrag 0 €).

alter table public.settings
  add column giveaway_active boolean not null default false,
  add column giveaway_end date,
  add column giveaway_discount_percent integer not null default 30
    check (giveaway_discount_percent between 1 and 90);

-- Kurzer, gut lesbarer Code ohne verwechselbare Zeichen (kein 0/O, 1/I/L).
create function public.generate_short_code(p_len integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(p_len);
  out text := '';
  i integer;
begin
  for i in 0 .. p_len - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end;
$$;

create table public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  company text check (char_length(company) <= 120),
  ref_code text not null unique default public.generate_short_code(8),
  confirm_token text not null unique default public.generate_ticket_token(),
  referred_by uuid references public.giveaway_entries (id) on delete set null,
  consent_version text not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  won_draw_id bigint,
  anonymized_at timestamptz
);
comment on table public.giveaway_entries is
  'Teilnehmer am Gewinnspiel. Erst nach Bestätigung (confirmed_at) im Lostopf und im Newsletter.';
create index giveaway_entries_referred_by on public.giveaway_entries (referred_by);

create table public.giveaway_draws (
  id bigint generated always as identity primary key,
  drawn_at timestamptz not null default now(),
  drawn_by uuid references auth.users (id) on delete set null,
  winner_entry_id uuid references public.giveaway_entries (id) on delete set null,
  pool_size integer not null,
  lots integer not null,
  mails_sent integer not null default 0
);
alter table public.giveaway_entries
  add constraint giveaway_entries_won_draw foreign key (won_draw_id)
  references public.giveaway_draws (id) on delete set null;

create table public.discount_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{6,24}$'),
  kind text not null check (kind in ('trostpreis', 'gewinn')),
  percent integer not null check (percent between 1 and 100),
  entry_id uuid references public.giveaway_entries (id) on delete set null,
  weekdays smallint[] check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  allow_specials boolean not null default false,
  valid_until date not null,
  created_at timestamptz not null default now(),
  unique (entry_id, kind)
);
comment on table public.discount_codes is
  'Persönliche Codes nur aus dem Gewinnspiel – keine öffentlichen Rabattcodes.';

alter table public.bookings
  add column discount_code text references public.discount_codes (code),
  add column discount_cents integer not null default 0 check (discount_cents >= 0);
-- Ein Code nur einmal: wie beim Zeitfenster zählen reservierte und bezahlte Buchungen.
create unique index bookings_discount_code_once on public.bookings (discount_code)
  where discount_code is not null and status in ('pending', 'paid');

-- RLS: nur Admins lesen; geschrieben wird ausschließlich serverseitig (service_role).
alter table public.giveaway_entries enable row level security;
alter table public.giveaway_draws enable row level security;
alter table public.discount_codes enable row level security;
revoke all on public.giveaway_entries, public.giveaway_draws, public.discount_codes
  from anon, authenticated;
grant select on public.giveaway_entries, public.giveaway_draws, public.discount_codes
  to authenticated;
create policy "admin liest giveaway_entries" on public.giveaway_entries
  for select to authenticated using (public.is_admin_aal2());
create policy "admin liest giveaway_draws" on public.giveaway_draws
  for select to authenticated using (public.is_admin_aal2());
create policy "admin liest discount_codes" on public.discount_codes
  for select to authenticated using (public.is_admin_aal2());

-- Preis eines Zeitfensters mit Code. reason: null = gültig, sonst unknown | expired | used |
-- weekday | special. Bei 100 % (Gewinn): alles 0 €, Händler-Anteil = halber Freiverzehr.
create function public.discount_pricing(p_code text, p_date date, p_start time)
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
  c public.discount_codes%rowtype;
  p record;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_disc integer;
  v_total integer;
begin
  select * into c from public.discount_codes x where x.code = upper(trim(p_code));
  if c.code is null then
    return query select 'unknown'::text, null::int, null::int, null::int, null::int, null::int, null::int, null::int, null::int;
    return;
  end if;
  select * into p from public.slot_pricing(p_date, p_start);
  if v_today > c.valid_until or p_date > c.valid_until then
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
  return query select null::text, c.percent, p.total_cents, v_disc, v_total, p.fee_cents,
                      v_total - p.fee_cents, p.taler_cents,
                      p.taler_cents + greatest(v_total - p.fee_cents - p.taler_cents, 0) / 2;
end;
$$;
revoke execute on function public.discount_pricing(text, date, time) from public, anon, authenticated;

-- Vorschau für das Buchungsformular (öffentlich, ohne Händler-Anteil).
create function public.preview_discount(p_code text, p_date date, p_start time)
returns table (reason text, percent integer, base_total_cents integer, discount_cents integer, total_cents integer)
language sql
volatile
security definer
set search_path = ''
as $$
  select d.reason, d.percent, d.base_total_cents, d.discount_cents, d.total_cents
    from public.discount_pricing(p_code, p_date, p_start) d;
$$;
revoke execute on function public.preview_discount(text, date, time) from public;
grant execute on function public.preview_discount(text, date, time) to anon, authenticated;

-- Öffentliche Eckdaten für Startseite und Gewinnspiel-Seite.
create function public.get_giveaway_info()
returns table (active boolean, ends date, next_draw date, participants integer, draws integer, discount_percent integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.giveaway_active
           and (s.giveaway_end is null or s.giveaway_end >= (now() at time zone 'Europe/Berlin')::date),
         coalesce(s.giveaway_end, s.season_end),
         -- nächster Montag (heute, falls Montag)
         ((now() at time zone 'Europe/Berlin')::date
           + ((8 - extract(isodow from (now() at time zone 'Europe/Berlin')::date)::int) % 7))::date,
         (select count(*)::int from public.giveaway_entries
           where confirmed_at is not null and unsubscribed_at is null),
         (select count(*)::int from public.giveaway_draws),
         s.giveaway_discount_percent
    from public.settings s
   where s.id = 1;
$$;
revoke execute on function public.get_giveaway_info() from public;
grant execute on function public.get_giveaway_info() to anon, authenticated;

-- Ziehung (nur serverseitig, Edge Function `admin`): Lostopf = bestätigt, nicht abgemeldet,
-- noch nicht gewonnen. Lose = 1 + bestätigte Freunde. Gewichteter Zufall.
-- Liefert Gewinner und alle anderen samt (wiederverwendetem) Trostpreis-Code.
create function public.giveaway_draw(p_admin uuid)
returns table (
  draw_id bigint,
  role text,
  entry_id uuid,
  email text,
  first_name text,
  code text,
  code_used boolean,
  unsubscribe_token text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  s public.settings%rowtype;
  v_draw bigint;
  v_winner uuid;
  v_pool integer;
  v_lots integer;
  v_until date;
begin
  select * into s from public.settings where id = 1;
  v_until := greatest(s.season_end, (now() at time zone 'Europe/Berlin')::date);

  drop table if exists pg_temp.giveaway_pool;
  create temp table giveaway_pool on commit drop as
    select e.id, 1 + (select count(*) from public.giveaway_entries f
                       where f.referred_by = e.id and f.confirmed_at is not null)::int as lots
      from public.giveaway_entries e
     where e.confirmed_at is not null and e.unsubscribed_at is null
       and e.won_draw_id is null and e.anonymized_at is null;

  select count(*), coalesce(sum(lots), 0) into v_pool, v_lots from pg_temp.giveaway_pool;
  if v_pool = 0 then
    raise exception 'Keine Teilnehmer im Lostopf' using errcode = 'P0002';
  end if;

  -- Gewichtete Zufallsauswahl (Efraimidis–Spirakis)
  select gp.id into v_winner from pg_temp.giveaway_pool gp order by -ln(1 - random()) / gp.lots limit 1;

  insert into public.giveaway_draws (drawn_by, winner_entry_id, pool_size, lots)
  values (p_admin, v_winner, v_pool, v_lots) returning id into v_draw;
  update public.giveaway_entries set won_draw_id = v_draw where id = v_winner;

  insert into public.discount_codes (code, kind, percent, entry_id, weekdays, allow_specials, valid_until)
  values ('GEWINN-' || public.generate_short_code(8), 'gewinn', 100, v_winner, null, false, v_until)
  on conflict (entry_id, kind) do nothing;

  insert into public.discount_codes (code, kind, percent, entry_id, weekdays, allow_specials, valid_until)
  select 'LOUNGE-' || public.generate_short_code(6), 'trostpreis', s.giveaway_discount_percent,
         p.id, array[1, 2, 3, 4]::smallint[], false, v_until
    from pg_temp.giveaway_pool p
   where p.id <> v_winner
  on conflict (entry_id, kind) do nothing;

  return query
  select v_draw,
         case when e.id = v_winner then 'gewinn' else 'trostpreis' end,
         e.id, e.email, e.first_name, c.code,
         exists (select 1 from public.bookings b
                  where b.discount_code = c.code and b.status in ('pending', 'paid')),
         e.confirm_token
    from pg_temp.giveaway_pool p
    join public.giveaway_entries e on e.id = p.id
    join public.discount_codes c
      on c.entry_id = e.id and c.kind = case when e.id = v_winner then 'gewinn' else 'trostpreis' end;
end;
$$;
revoke execute on function public.giveaway_draw(uuid) from public, anon, authenticated;
