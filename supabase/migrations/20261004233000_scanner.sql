-- =====================================================================================
-- Phase 6: Scanner (/scan) für die Mitarbeitenden am Einlass
-- Kein Konto: 6-stellige PIN → signiertes Token (Edge Function `scanner`).
-- Alle Funktionen hier sind nur für service_role ausführbar (die Edge Function).
-- =====================================================================================

-- PIN prüfen mit Sperre: 5 Fehlversuche je Gerät (IP-Hash) → 10 Minuten gesperrt.
-- Zusätzlich gerätübergreifend: 30 Fehlversuche in 10 Minuten → 10 Minuten Pause für alle
-- (schützt die 6-stellige PIN auch dann, wenn jemand ständig die IP wechselt oder fälscht).
create function public.scanner_check_pin(p_ip_hash text, p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.settings%rowtype;
  a public.scanner_attempts%rowtype;
  g public.scanner_attempts%rowtype;
  v_fails integer;
  v_global integer;
begin
  select * into s from public.settings where id = 1;
  if s.scanner_pin_hash is null then
    return jsonb_build_object('ok', false, 'reason', 'no_pin');
  end if;

  select * into g from public.scanner_attempts where ip_hash = '*global*' for update;
  if g.locked_until is not null and g.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', g.locked_until);
  end if;

  select * into a from public.scanner_attempts where ip_hash = p_ip_hash for update;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', a.locked_until);
  end if;

  if coalesce(p_pin, '') ~ '^[0-9]{6}$'
     and extensions.crypt(p_pin, s.scanner_pin_hash) = s.scanner_pin_hash then
    delete from public.scanner_attempts where ip_hash = p_ip_hash;
    return jsonb_build_object('ok', true, 'version', s.scanner_token_version);
  end if;

  v_global := case when g.updated_at is null or g.updated_at < now() - interval '10 minutes'
                     or g.locked_until is not null then 1 else g.failed_count + 1 end;
  insert into public.scanner_attempts (ip_hash, failed_count, locked_until, updated_at)
  values ('*global*', v_global, case when v_global >= 30 then now() + interval '10 minutes' end, now())
  on conflict (ip_hash) do update
     set failed_count = excluded.failed_count,
         locked_until = excluded.locked_until,
         updated_at = now();

  -- Abgelaufene Sperre zählt neu
  v_fails := case when a.locked_until is not null then 1 else coalesce(a.failed_count, 0) + 1 end;
  insert into public.scanner_attempts (ip_hash, failed_count, locked_until, updated_at)
  values (p_ip_hash, v_fails, case when v_fails >= 5 then now() + interval '10 minutes' end, now())
  on conflict (ip_hash) do update
     set failed_count = excluded.failed_count,
         locked_until = excluded.locked_until,
         updated_at = now();
  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + interval '10 minutes');
  end if;
  return jsonb_build_object('ok', false, 'reason', 'wrong_pin', 'remaining', 5 - v_fails);
end;
$$;

create function public.scanner_token_version()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select scanner_token_version from public.settings where id = 1;
$$;

-- Anzeige-Daten einer Buchung für den Scanner (keine E-Mail, kein Telefon).
create function public.scanner_booking_json(b public.bookings)
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
    'taler_handed_out_at', b.taler_handed_out_at
  );
$$;

-- Zeitpunkt eines Scans: Gerätezeit nur bei nachgetragenen Offline-Scans (max. 24 h zurück).
create function public.scanner_effective_time(p_scanned_at timestamptz, p_offline boolean)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_offline and p_scanned_at between now() - interval '24 hours' and now() + interval '5 minutes'
      then least(p_scanned_at, now())
    else now()
  end;
$$;

-- QR-Code (ticket_token) oder Buchungscode (HL-XXXX-XXXX, auch ohne Bindestriche) prüfen.
-- Ergebnisse: ok (grün), already (gelb), wrong_slot (orange, ohne Check-in), override (orange,
-- bewusst eingecheckt), invalid (rot: unbekannt, storniert, nicht bezahlt).
create function public.scanner_scan(
  p_code text,
  p_override boolean default false,
  p_scanned_at timestamptz default null,
  p_offline boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_raw text := btrim(coalesce(p_code, ''));
  v_code text := upper(regexp_replace(v_raw, '[\s-]', '', 'g'));
  v_at timestamptz := public.scanner_effective_time(p_scanned_at, p_offline);
  b public.bookings%rowtype;
  v_early integer;
  v_result text;
begin
  if v_raw ~ '^[A-Za-z0-9]{32}$' then
    select * into b from public.bookings where ticket_token = v_raw for update;
  elsif v_code ~ '^HL[A-Z0-9]{8}$' then
    select * into b from public.bookings
     where booking_code = 'HL-' || substr(v_code, 3, 4) || '-' || substr(v_code, 7, 4)
     for update;
  end if;

  if b.id is null then
    insert into public.scan_log (code_entered, result, scanned_at_device, synced_offline)
    values (left(v_raw, 12), 'invalid', p_scanned_at, p_offline);
    return jsonb_build_object('result', 'invalid', 'reason', 'unknown');
  end if;

  if b.status <> 'paid' or b.anonymized_at is not null then
    insert into public.scan_log (booking_id, code_entered, result, scanned_at_device, synced_offline)
    values (b.id, b.booking_code, 'unpaid', p_scanned_at, p_offline);
    return jsonb_build_object(
      'result', 'invalid',
      'reason', case when b.status = 'cancelled' then 'cancelled' else 'unpaid' end,
      'booking', public.scanner_booking_json(b)
    );
  end if;

  -- Schon eingecheckt: nie überschreiben (auch nicht beim Offline-Nachtrag)
  if b.checked_in_at is not null then
    insert into public.scan_log (booking_id, code_entered, result, scanned_at_device, synced_offline)
    values (b.id, b.booking_code, 'already', p_scanned_at, p_offline);
    return jsonb_build_object('result', 'already', 'booking', public.scanner_booking_json(b));
  end if;

  select checkin_early_minutes into v_early from public.settings where id = 1;
  if v_at < public.slot_starts_at(b.date, b.start_time) - make_interval(mins => v_early)
     or v_at > public.slot_starts_at(b.date, b.end_time) then
    if not coalesce(p_override, false) then
      insert into public.scan_log (booking_id, code_entered, result, scanned_at_device, synced_offline)
      values (b.id, b.booking_code, 'wrong_slot', p_scanned_at, p_offline);
      return jsonb_build_object('result', 'wrong_slot', 'booking', public.scanner_booking_json(b));
    end if;
    v_result := 'override';
  else
    v_result := 'ok';
  end if;

  update public.bookings set checked_in_at = v_at where id = b.id returning * into b;
  insert into public.scan_log (booking_id, code_entered, result, scanned_at_device, synced_offline)
  values (b.id, b.booking_code, v_result, p_scanned_at, p_offline);
  return jsonb_build_object('result', v_result, 'booking', public.scanner_booking_json(b));
end;
$$;

-- Residenztaler übergeben (setzt auch den Check-in, falls noch nicht geschehen).
create function public.scanner_taler(
  p_booking_id uuid,
  p_scanned_at timestamptz default null,
  p_offline boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := public.scanner_effective_time(p_scanned_at, p_offline);
  b public.bookings%rowtype;
  v_already boolean;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or b.status <> 'paid' then
    return jsonb_build_object('ok', false);
  end if;
  v_already := b.taler_handed_out_at is not null;
  if not v_already then
    update public.bookings
       set taler_handed_out_at = v_at, checked_in_at = coalesce(checked_in_at, v_at)
     where id = b.id
    returning * into b;
  end if;
  insert into public.scan_log (booking_id, code_entered, result, scanned_at_device, synced_offline)
  values (b.id, b.booking_code, 'taler', p_scanned_at, p_offline);
  return jsonb_build_object('ok', true, 'already', v_already, 'booking', public.scanner_booking_json(b));
end;
$$;

-- Liste „Heute“ (Europe/Berlin) für Anzeige und Offline-Prüfung. Statt des Ticket-Tokens nur
-- dessen SHA-256 – das Gerät vergleicht den gescannten Code mit dem Hash.
create function public.scanner_today()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'date', (now() at time zone 'Europe/Berlin')::date,
    'checkin_early_minutes', (select checkin_early_minutes from public.settings where id = 1),
    'bookings', coalesce(jsonb_agg(
      public.scanner_booking_json(b)
        || jsonb_build_object('token_hash', encode(extensions.digest(b.ticket_token, 'sha256'), 'hex'))
      order by b.start_time
    ), '[]'::jsonb)
  )
  from public.bookings b
  where b.date = (now() at time zone 'Europe/Berlin')::date
    and b.status in ('paid', 'cancelled')
    and b.anonymized_at is null;
$$;

revoke execute on function public.scanner_check_pin(text, text) from public, anon, authenticated;
revoke execute on function public.scanner_token_version() from public, anon, authenticated;
revoke execute on function public.scanner_booking_json(public.bookings) from public, anon, authenticated;
revoke execute on function public.scanner_effective_time(timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.scanner_scan(text, boolean, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.scanner_taler(uuid, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.scanner_today() from public, anon, authenticated;
grant execute on function public.scanner_check_pin(text, text) to service_role;
grant execute on function public.scanner_token_version() to service_role;
grant execute on function public.scanner_scan(text, boolean, timestamptz, boolean) to service_role;
grant execute on function public.scanner_taler(uuid, timestamptz, boolean) to service_role;
grant execute on function public.scanner_today() to service_role;
