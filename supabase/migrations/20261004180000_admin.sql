-- =====================================================================================
-- Phase 5: Studio-F-Admin
-- Alle Funktionen prüfen serverseitig is_admin_aal2() (Rolle studio_admin + 2FA).
-- Schreibende Buchungsaktionen laufen nur über diese Funktionen bzw. die Edge Function `admin`.
-- =====================================================================================

create function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_aal2() then
    raise exception 'Nur für Admins mit Zwei-Faktor-Anmeldung' using errcode = '42501';
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Kennzahlen
-- Buchungs-Kennzahlen beziehen sich auf das Lounge-Datum im Zeitraum.
-- Aufrufe/Klicks und die Abschlussquote beziehen sich auf den Zeitpunkt im Zeitraum (Berliner Zeit):
-- Abschlussquote = online bezahlte Buchungen (paid_at im Zeitraum) ÷ Klicks auf „Lounge buchen“.
-- -------------------------------------------------------------------------------------
create function public.admin_dashboard(p_from date, p_to date)
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

-- -------------------------------------------------------------------------------------
-- Buchungsaktionen
-- -------------------------------------------------------------------------------------
create function public.admin_check_in(p_booking_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ts timestamptz;
begin
  perform public.assert_admin();
  update public.bookings
     set checked_in_at = coalesce(checked_in_at, now())
   where id = p_booking_id and status = 'paid'
  returning checked_in_at into ts;
  if ts is null then
    raise exception 'Nur bezahlte Buchungen können eingecheckt werden' using errcode = 'P0002';
  end if;
  insert into public.scan_log (booking_id, code_entered, result) values (p_booking_id, 'admin', 'ok');
  return ts;
end;
$$;

create function public.admin_mark_taler(p_booking_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ts timestamptz;
begin
  perform public.assert_admin();
  update public.bookings
     set taler_handed_out_at = coalesce(taler_handed_out_at, now()),
         checked_in_at = coalesce(checked_in_at, now())
   where id = p_booking_id and status = 'paid'
  returning taler_handed_out_at into ts;
  if ts is null then
    raise exception 'Nur bei bezahlten Buchungen möglich' using errcode = 'P0002';
  end if;
  insert into public.scan_log (booking_id, code_entered, result) values (p_booking_id, 'admin', 'taler');
  return ts;
end;
$$;

-- Storno durch Studio F. Gast-Stornos gibt es nicht. Erstattung erfolgt manuell in Stripe.
create function public.admin_cancel_booking(p_booking_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Bitte gib einen Grund für die Stornierung an' using errcode = '22023';
  end if;
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancel_reason = trim(p_reason)
   where id = p_booking_id and status in ('paid', 'pending');
  if not found then
    raise exception 'Buchung nicht gefunden oder bereits storniert' using errcode = 'P0002';
  end if;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Scanner-PIN: 6 Ziffern, bcrypt-Hash. Jede Änderung meldet alle Scanner ab (Version + 1).
-- -------------------------------------------------------------------------------------
create function public.admin_set_scanner_pin(p_pin text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v integer;
begin
  perform public.assert_admin();
  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'Die PIN muss aus genau 6 Ziffern bestehen' using errcode = '22023';
  end if;
  update public.settings
     set scanner_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
         scanner_token_version = scanner_token_version + 1
   where id = 1
  returning scanner_token_version into v;
  return v;
end;
$$;

create function public.admin_scanner_pin_set()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin_aal2() and scanner_pin_hash is not null from public.settings where id = 1;
$$;

-- -------------------------------------------------------------------------------------
-- Zugänge: Nutzer mit Rollen (E-Mail aus auth.users), 2FA-Status
-- -------------------------------------------------------------------------------------
create function public.admin_list_access()
returns table (
  user_id uuid,
  email text,
  roles text[],
  last_sign_in_at timestamptz,
  invited_at timestamptz,
  has_2fa boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
  select u.id, u.email::text,
         array_agg(r.role order by r.role),
         u.last_sign_in_at, u.invited_at,
         exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified')
    from auth.users u
    join public.user_roles r on r.user_id = u.id
   group by u.id
   order by u.email;
end;
$$;

-- Admins können sich nicht selbst die Admin-Rolle entziehen (sonst sperrt man sich aus).
create function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if p_role not in ('studio_admin', 'haendler') then
    raise exception 'Unbekannte Rolle' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() and p_role <> 'studio_admin' then
    raise exception 'Du kannst dir die Admin-Rolle nicht selbst entziehen' using errcode = '22023';
  end if;
  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id, role) values (p_user_id, p_role);
end;
$$;

create function public.admin_revoke_access(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if p_user_id = auth.uid() then
    raise exception 'Du kannst dir den Zugang nicht selbst entziehen' using errcode = '22023';
  end if;
  delete from public.user_roles where user_id = p_user_id;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Datenpflege: Kontaktdaten anonymisieren (Beträge, Status und Zeitpunkte bleiben)
-- -------------------------------------------------------------------------------------
create function public.admin_anonymize_before(p_before date)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.assert_admin();
  if p_before is null or p_before > (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Der Stichtag darf nicht in der Zukunft liegen' using errcode = '22023';
  end if;
  update public.bookings
     set first_name = 'Anonymisiert',
         last_name = '',
         email = 'anonymisiert@invalid',
         phone = '',
         company_name = null,
         vat_id = null,
         billing_street = null,
         billing_zip = null,
         billing_city = null,
         notes = null,
         anonymized_at = now()
   where date < p_before and anonymized_at is null and status <> 'pending';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Rechte
-- -------------------------------------------------------------------------------------
revoke execute on function public.assert_admin() from public, anon, authenticated;
revoke execute on function public.admin_dashboard(date, date) from public, anon;
revoke execute on function public.admin_check_in(uuid) from public, anon;
revoke execute on function public.admin_mark_taler(uuid) from public, anon;
revoke execute on function public.admin_cancel_booking(uuid, text) from public, anon;
revoke execute on function public.admin_set_scanner_pin(text) from public, anon;
revoke execute on function public.admin_scanner_pin_set() from public, anon;
revoke execute on function public.admin_list_access() from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
revoke execute on function public.admin_revoke_access(uuid) from public, anon;
revoke execute on function public.admin_anonymize_before(date) from public, anon;

grant execute on function public.admin_dashboard(date, date) to authenticated;
grant execute on function public.admin_check_in(uuid) to authenticated;
grant execute on function public.admin_mark_taler(uuid) to authenticated;
grant execute on function public.admin_cancel_booking(uuid, text) to authenticated;
grant execute on function public.admin_set_scanner_pin(text) to authenticated;
grant execute on function public.admin_scanner_pin_set() to authenticated;
grant execute on function public.admin_list_access() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_revoke_access(uuid) to authenticated;
grant execute on function public.admin_anonymize_before(date) to authenticated;

-- Admins lesen den E-Mail-Verlauf und Scan-Log bereits per RLS (Phase 2).
-- Admins dürfen Rollen nicht mehr direkt schreiben – nur über admin_set_role/admin_revoke_access.
drop policy if exists "admin verwaltet rollen" on public.user_roles;
revoke insert, update, delete on public.user_roles from authenticated;

-- Scanner-PIN-Hash und Version sind für Admins weder lesbar noch direkt schreibbar
-- (nur über admin_set_scanner_pin). Spaltenrechte statt Tabellenrechte.
revoke select, insert, update, delete on public.settings from authenticated;
grant select (
  id, season_start, season_end, price_cents, fee_cents, taler_count, taler_cents, haendler_share_cents,
  max_persons, booking_cutoff_minutes, hold_minutes, checkin_early_minutes, contact_email,
  lounge_location, updated_at
) on public.settings to authenticated;
grant update (
  season_start, season_end, price_cents, fee_cents, taler_count, taler_cents, haendler_share_cents,
  max_persons, booking_cutoff_minutes, hold_minutes, checkin_early_minutes, contact_email, lounge_location
) on public.settings to authenticated;
