-- =====================================================================================
-- Gewinnspiel: automatische Ziehung jeden Sonntag 18:00 Uhr (Europe/Berlin) und
-- 25-%-Codes, die nur 48 Stunden nach der Ziehung einlösbar sind (Entscheidung Louis,
-- 04.11.2026). Nur additiv.
--
-- * Trostpreis: 25 % (settings.giveaway_discount_percent), alle Wochentage, nicht für
--   Sonderveranstaltungen (Party-Abende 22./23./29./30.12., Heiligabend). Der Code muss innerhalb
--   von settings.giveaway_code_hours (48) nach der Ziehung gebucht werden (discount_codes.redeem_by);
--   der Lounge-Termin selbst darf bis Saisonende liegen. Nach jeder Ziehung gibt es neue 48 Stunden.
-- * Gewinn-Code (100 %) unverändert: ein freier Abend bis Saisonende, keine Sonderveranstaltungen.
-- * pg_cron ruft sonntags die Edge Function giveaway-draw auf (wie daily-report über Vault-Secrets).
--   Die Ziehung per Knopf im Admin bleibt möglich.
-- =====================================================================================

alter table public.settings
  add column if not exists giveaway_draw_isodow smallint not null default 7
    check (giveaway_draw_isodow between 1 and 7),
  add column if not exists giveaway_draw_hour smallint not null default 18
    check (giveaway_draw_hour between 0 and 23),
  add column if not exists giveaway_code_hours integer not null default 48
    check (giveaway_code_hours between 1 and 720);

update public.settings set giveaway_discount_percent = 25, updated_at = now() where id = 1;

alter table public.discount_codes
  add column if not exists redeem_by timestamptz;
comment on column public.discount_codes.redeem_by is
  'Muss bis zu diesem Zeitpunkt gebucht werden (Trostpreis: 48 Stunden nach der Ziehung). Leer = nur valid_until.';

-- Nächste Ziehung als Zeitpunkt (für den Countdown). Null, wenn das Gewinnspiel aus ist oder die
-- nächste Ziehung nach Aktionsende läge.
create function public.next_giveaway_draw()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.settings%rowtype;
  v_now timestamp := now() at time zone 'Europe/Berlin';
  v_day date;
  v_at timestamp;
begin
  select * into s from public.settings where id = 1;
  if not s.giveaway_active then
    return null;
  end if;
  v_day := v_now::date + ((s.giveaway_draw_isodow - extract(isodow from v_now)::int + 7) % 7);
  v_at := v_day + make_interval(hours => s.giveaway_draw_hour);
  if v_at <= v_now then
    v_at := v_at + interval '7 days';
  end if;
  if v_at::date > coalesce(s.giveaway_end, s.season_end) then
    return null;
  end if;
  return v_at at time zone 'Europe/Berlin';
end;
$$;
revoke execute on function public.next_giveaway_draw() from public;
grant execute on function public.next_giveaway_draw() to anon, authenticated;

-- Rabattpreis: zusätzlich Einlösefrist redeem_by prüfen (sonst unverändert).
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
  return query select null::text, c.percent, p.total_cents, v_disc, v_total, p.fee_cents,
                      v_total - p.fee_cents, p.taler_cents,
                      p.taler_cents + greatest(v_total - p.fee_cents - p.taler_cents, 0) / 2;
end;
$$;
revoke execute on function public.discount_pricing(text, date, time) from public, anon, authenticated;

-- Ziehung: wie bisher, aber Trostpreis-Codes gelten an allen Tagen (ohne Sonderveranstaltungen)
-- und bekommen bei jeder Ziehung neu 48 Stunden Einlösefrist. Automatische Ziehung
-- (p_admin = null) höchstens einmal in 12 Stunden.
create or replace function public.giveaway_draw(p_admin uuid)
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
  v_redeem_by timestamptz;
begin
  select * into s from public.settings where id = 1;
  v_until := greatest(s.season_end, (now() at time zone 'Europe/Berlin')::date);
  v_redeem_by := now() + make_interval(hours => s.giveaway_code_hours);

  if p_admin is null and exists (
    select 1 from public.giveaway_draws d where d.drawn_at > now() - interval '12 hours'
  ) then
    raise exception 'Heute wurde schon gezogen' using errcode = 'P0003';
  end if;

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

  insert into public.discount_codes
         (code, kind, percent, entry_id, weekdays, allow_specials, valid_until, redeem_by)
  select 'LOUNGE-' || public.generate_short_code(6), 'trostpreis', s.giveaway_discount_percent,
         p.id, null, false, v_until, v_redeem_by
    from pg_temp.giveaway_pool p
   where p.id <> v_winner
  on conflict (entry_id, kind) do update
     set percent = excluded.percent,
         weekdays = null,
         allow_specials = false,
         valid_until = excluded.valid_until,
         redeem_by = excluded.redeem_by;

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

-- Automatischer Aufruf: stündlich sonntags zur vollen Stunde (UTC), wirkt nur zur Ziehungsstunde
-- in Berlin – so passt es im Winter wie im Sommer.
create function public.invoke_giveaway_draw()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.settings%rowtype;
  v_now timestamp := now() at time zone 'Europe/Berlin';
  v_url text;
  v_secret text;
begin
  select * into s from public.settings where id = 1;
  if not s.giveaway_active
     or extract(isodow from v_now)::int <> s.giveaway_draw_isodow
     or extract(hour from v_now)::int <> s.giveaway_draw_hour
     or v_now::date > coalesce(s.giveaway_end, s.season_end) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/giveaway-draw',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.invoke_giveaway_draw() from public, anon, authenticated;

select cron.schedule('giveaway-draw', '0 * * * 0', $$select public.invoke_giveaway_draw();$$);
