-- =====================================================================================
-- Phase 2: Grundschema der Weihnachtsmarkt-Lounge
-- Regeln (CLAUDE.md): RLS auf allen Tabellen, Beträge in Cent, Zeitzone Europe/Berlin,
-- Geld- und Statusänderungen nur serverseitig. Migrations sind nur additiv.
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;

-- -------------------------------------------------------------------------------------
-- Tabellen
-- -------------------------------------------------------------------------------------

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  season_start date not null,
  season_end date not null,
  price_cents integer not null check (price_cents > 0),
  fee_cents integer not null check (fee_cents >= 0),
  taler_count integer not null check (taler_count >= 0),
  taler_cents integer not null check (taler_cents >= 0),
  haendler_share_cents integer not null check (haendler_share_cents >= 0),
  max_persons integer not null check (max_persons between 1 and 50),
  booking_cutoff_minutes integer not null default 60 check (booking_cutoff_minutes >= 0),
  hold_minutes integer not null default 30 check (hold_minutes between 30 and 180),
  checkin_early_minutes integer not null default 30 check (checkin_early_minutes >= 0),
  contact_email text not null,
  scanner_pin_hash text,
  scanner_token_version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint season_order check (season_start <= season_end),
  constraint shares_within_price check (
    taler_cents <= price_cents and haendler_share_cents <= price_cents
  )
);
comment on table public.settings is 'Genau eine Zeile. Öffentlich nur über get_public_settings().';

create table public.slot_templates (
  id bigint generated always as identity primary key,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = Montag … 7 = Sonntag
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  constraint slot_order check (start_time < end_time),
  constraint slot_templates_unique unique (weekday, start_time)
);

create table public.closed_dates (
  date date primary key,
  reason text,
  created_at timestamptz not null default now()
);

create table public.blocked_slots (
  id bigint generated always as identity primary key,
  date date not null,
  start_time time not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_slots_unique unique (date, start_time)
);

-- Buchungscode HL-XXXX-XXXX ohne verwechselbare Zeichen (0/O, 1/I/L).
create function public.generate_booking_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return 'HL-' || substr(code, 1, 4) || '-' || substr(code, 5, 4);
end;
$$;

-- Ticket-Token: 32 Zeichen, kryptografisch zufällig (Base62).
create function public.generate_ticket_token()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  bytes bytea := extensions.gen_random_bytes(64);
  token text := '';
  b integer;
  i integer := 0;
begin
  -- Rejection Sampling: nur Bytes < 248 (= 4 × 62) verwenden, damit alle Zeichen gleich wahrscheinlich sind.
  while length(token) < 32 loop
    if i >= 64 then
      bytes := extensions.gen_random_bytes(64);
      i := 0;
    end if;
    b := get_byte(bytes, i);
    i := i + 1;
    if b < 248 then
      token := token || substr(alphabet, (b % 62) + 1, 1);
    end if;
  end loop;
  return token;
end;
$$;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default public.generate_booking_code(),
  ticket_token text not null unique default public.generate_ticket_token(),
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'expired')),
  source text not null default 'online' check (source in ('online', 'manual')),
  payment_method text not null default 'stripe'
    check (payment_method in ('stripe', 'bar', 'ueberweisung', 'kostenlos')),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  persons integer not null check (persons between 1 and 50),
  occasion text not null check (occasion in ('firmenfeier', 'familienfeier', 'freunde', 'sonstiges')),
  company_name text,
  vat_id text,
  invoice_requested boolean not null default false,
  billing_street text,
  billing_zip text,
  billing_city text,
  notes text,
  newsletter_opt_in boolean not null default false,
  terms_accepted_at timestamptz,
  -- Beträge werden beim Anlegen aus settings kopiert (Trigger) und danach nicht mehr verändert.
  price_cents integer not null,
  fee_cents integer not null,
  taler_cents integer not null,
  haendler_share_cents integer not null,
  amount_total_cents integer not null,
  include_in_settlement boolean not null default true,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_invoice_url text,
  hold_expires_at timestamptz,
  paid_at timestamptz,
  checked_in_at timestamptz,
  taler_handed_out_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  reminder_sent_at timestamptz,
  admin_override boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint booking_slot_order check (start_time < end_time),
  constraint pending_needs_hold check (status <> 'pending' or hold_expires_at is not null)
);

-- Kernregel: Jedes Zeitfenster kann genau einmal verkauft (oder reserviert) werden.
create unique index bookings_one_per_slot
  on public.bookings (date, start_time)
  where status in ('pending', 'paid');

create index bookings_status_idx on public.bookings (status);
create index bookings_date_idx on public.bookings (date);
create index bookings_hold_idx on public.bookings (hold_expires_at) where status = 'pending';

create table public.scan_log (
  id bigint generated always as identity primary key,
  booking_id uuid references public.bookings (id) on delete set null,
  code_entered text,
  result text not null
    check (result in ('ok', 'already', 'wrong_slot', 'override', 'invalid', 'unpaid', 'taler')),
  scanned_at_device timestamptz,
  synced_offline boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.scanner_attempts (
  ip_hash text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.page_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view', 'book_click')),
  device text not null check (device in ('mobile', 'desktop')),
  created_at timestamptz not null default now()
);
comment on table public.page_events is 'Cookieloses Tracking: keine IP, kein User-Agent, keine IDs.';
create index page_events_created_idx on public.page_events (created_at);

create table public.email_log (
  id bigint generated always as identity primary key,
  booking_id uuid references public.bookings (id) on delete set null,
  type text not null check (type in ('ticket', 'reminder', 'doi', 'contact')),
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('studio_admin', 'haendler')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- -------------------------------------------------------------------------------------
-- Trigger
-- -------------------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- Beträge beim Anlegen serverseitig aus settings kopieren. Vom Client kommen nie Preise.
create function public.bookings_fill_amounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.settings;
begin
  select * into s from public.settings where id = 1;
  if not found then
    raise exception 'settings fehlt';
  end if;
  new.price_cents := coalesce(new.price_cents, s.price_cents);
  new.fee_cents := coalesce(new.fee_cents, s.fee_cents);
  new.taler_cents := coalesce(new.taler_cents, s.taler_cents);
  new.haendler_share_cents := coalesce(new.haendler_share_cents, s.haendler_share_cents);
  new.amount_total_cents := coalesce(new.amount_total_cents, new.price_cents + new.fee_cents);
  return new;
end;
$$;

create trigger bookings_fill_amounts before insert on public.bookings
  for each row execute function public.bookings_fill_amounts();

-- Gespeicherte Beträge sind unveränderlich (Abrechnung basiert darauf).
create function public.bookings_lock_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.price_cents is distinct from old.price_cents
     or new.fee_cents is distinct from old.fee_cents
     or new.taler_cents is distinct from old.taler_cents
     or new.haendler_share_cents is distinct from old.haendler_share_cents
     or new.amount_total_cents is distinct from old.amount_total_cents then
    raise exception 'Beträge einer Buchung dürfen nicht geändert werden';
  end if;
  return new;
end;
$$;

create trigger bookings_lock_amounts before update on public.bookings
  for each row execute function public.bookings_lock_amounts();

-- -------------------------------------------------------------------------------------
-- Rollen
-- -------------------------------------------------------------------------------------

create function public.has_role(uid uuid, role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = uid and ur.role = has_role.role
  );
$$;

-- Admin-Zugriff nur mit Zwei-Faktor-Anmeldung (aal2).
create function public.is_admin_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(auth.uid(), 'studio_admin')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- -------------------------------------------------------------------------------------
-- Öffentliche und interne Funktionen
-- -------------------------------------------------------------------------------------

-- Abgelaufene Reservierungen freigeben.
create function public.expire_stale_holds()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with expired as (
    update public.bookings
       set status = 'expired'
     where status = 'pending'
       and hold_expires_at < now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- Startzeitpunkt eines Zeitfensters (Berliner Ortszeit) als timestamptz.
create function public.slot_starts_at(d date, t time)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (d + t) at time zone 'Europe/Berlin';
$$;

create function public.get_public_settings()
returns table (
  price_cents integer,
  fee_cents integer,
  taler_count integer,
  max_persons integer,
  season_start date,
  season_end date,
  contact_email text,
  booking_cutoff_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.price_cents, s.fee_cents, s.taler_count, s.max_persons,
         s.season_start, s.season_end, s.contact_email, s.booking_cutoff_minutes
    from public.settings s
   where s.id = 1;
$$;

-- Verfügbarkeit pro Tag und Zeitfenster – ohne personenbezogene Daten.
-- Status-Priorität: out_of_season > closed > past > taken > blocked > free.
create function public.get_availability(from_date date, to_date date)
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
  with s as (select * from public.settings where id = 1),
  days as (
    select d::date as d from generate_series(from_date, to_date, interval '1 day') g(d)
  )
  select
    days.d,
    t.start_time,
    t.end_time,
    case
      when days.d < s.season_start or days.d > s.season_end then 'out_of_season'
      when exists (select 1 from public.closed_dates c where c.date = days.d) then 'closed'
      when public.slot_starts_at(days.d, t.start_time)
           - make_interval(mins => s.booking_cutoff_minutes) <= now() then 'past'
      when exists (
        select 1 from public.bookings b
         where b.date = days.d and b.start_time = t.start_time
           and b.status in ('pending', 'paid')
      ) then 'taken'
      when exists (
        select 1 from public.blocked_slots bs
         where bs.date = days.d and bs.start_time = t.start_time
      ) then 'blocked'
      else 'free'
    end
  from days
  cross join s
  join public.slot_templates t
    on t.weekday = extract(isodow from days.d)::smallint and t.active
  order by days.d, t.start_time;
end;
$$;

-- Cookieloses Tracking. Nur erlaubte Werte, keine personenbezogenen Daten.
create function public.track_event(event_type text, device text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if event_type not in ('page_view', 'book_click') or device not in ('mobile', 'desktop') then
    raise exception 'Ungültiges Event' using errcode = '22023';
  end if;
  insert into public.page_events (event_type, device) values (event_type, device);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Rechte: Supabase vergibt standardmäßig breite Rechte an anon/authenticated.
-- Wir nehmen alles weg und geben gezielt frei. RLS ist die zweite Schutzschicht.
-- -------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on public.settings, public.slot_templates,
  public.closed_dates, public.blocked_slots to authenticated;
grant select on public.bookings, public.scan_log, public.email_log, public.scanner_attempts,
  public.page_events to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;

grant execute on function public.get_public_settings() to anon, authenticated;
grant execute on function public.get_availability(date, date) to anon, authenticated;
grant execute on function public.track_event(text, text) to anon, authenticated;
grant execute on function public.has_role(uuid, text) to authenticated;
grant execute on function public.is_admin_aal2() to authenticated;
grant execute on function public.slot_starts_at(date, time) to anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------------------------------

alter table public.settings enable row level security;
alter table public.slot_templates enable row level security;
alter table public.closed_dates enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.scan_log enable row level security;
alter table public.scanner_attempts enable row level security;
alter table public.page_events enable row level security;
alter table public.email_log enable row level security;
alter table public.user_roles enable row level security;

create policy "admin verwaltet settings" on public.settings
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());
create policy "admin verwaltet slot_templates" on public.slot_templates
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());
create policy "admin verwaltet closed_dates" on public.closed_dates
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());
create policy "admin verwaltet blocked_slots" on public.blocked_slots
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());

-- Buchungen: nur lesen für Admins. Schreiben ausschließlich über Edge Functions (service_role).
create policy "admin liest bookings" on public.bookings
  for select to authenticated using (public.is_admin_aal2());

create policy "admin liest scan_log" on public.scan_log
  for select to authenticated using (public.is_admin_aal2());
create policy "admin liest email_log" on public.email_log
  for select to authenticated using (public.is_admin_aal2());
create policy "admin liest scanner_attempts" on public.scanner_attempts
  for select to authenticated using (public.is_admin_aal2());

create policy "admin und haendler lesen page_events" on public.page_events
  for select to authenticated
  using (public.is_admin_aal2() or public.has_role(auth.uid(), 'haendler'));

create policy "eigene rollen lesen" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin_aal2());
create policy "admin verwaltet rollen" on public.user_roles
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());

-- -------------------------------------------------------------------------------------
-- Startdaten (Platzhalter, im Admin änderbar)
-- -------------------------------------------------------------------------------------

insert into public.settings (
  id, season_start, season_end, price_cents, fee_cents, taler_count, taler_cents,
  haendler_share_cents, max_persons, booking_cutoff_minutes, hold_minutes,
  checkin_early_minutes, contact_email
) values (
  1, '2026-11-26', '2026-12-23', 17500, 350, 100, 10000,
  13750, 10, 60, 30,
  30, 'info@studio-f.club'
) on conflict (id) do nothing;

insert into public.slot_templates (weekday, start_time, end_time)
select wd, st::time, et::time
  from generate_series(1, 5) wd,
       (values ('17:00', '19:00'), ('19:00', '21:00')) v(st, et)
union all
select wd, st::time, et::time
  from generate_series(6, 7) wd,
       (values ('17:30', '19:30'), ('19:30', '21:30')) v(st, et)
on conflict (weekday, start_time) do nothing;
