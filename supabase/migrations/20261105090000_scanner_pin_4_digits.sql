-- Scanner-PIN mit 4 statt 6 Ziffern (Entscheidung Louis, 05.11.2026).
-- Weil 4 Ziffern nur 10.000 Möglichkeiten haben, sind die Sperren strenger:
--   je Gerät 5 Fehlversuche → 15 Minuten gesperrt (vorher 10),
--   gerätübergreifend 20 Fehlversuche innerhalb einer Stunde → 1 Stunde Pause für alle
--   (vorher 30 in 10 Minuten). Bereits angemeldete Scanner (Token 12 h) sind davon nicht betroffen.
-- Eine vorhandene 6-stellige PIN gilt nicht mehr: Im Admin eine neue 4-stellige PIN setzen.

create or replace function public.scanner_check_pin(p_ip_hash text, p_pin text)
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

  if coalesce(p_pin, '') ~ '^[0-9]{4}$'
     and extensions.crypt(p_pin, s.scanner_pin_hash) = s.scanner_pin_hash then
    delete from public.scanner_attempts where ip_hash = p_ip_hash;
    return jsonb_build_object('ok', true, 'version', s.scanner_token_version);
  end if;

  v_global := case when g.updated_at is null or g.updated_at < now() - interval '1 hour'
                     or g.locked_until is not null then 1 else g.failed_count + 1 end;
  insert into public.scanner_attempts (ip_hash, failed_count, locked_until, updated_at)
  values ('*global*', v_global, case when v_global >= 20 then now() + interval '1 hour' end, now())
  on conflict (ip_hash) do update
     set failed_count = excluded.failed_count,
         locked_until = excluded.locked_until,
         updated_at = now();

  -- Abgelaufene Sperre zählt neu
  v_fails := case when a.locked_until is not null then 1 else coalesce(a.failed_count, 0) + 1 end;
  insert into public.scanner_attempts (ip_hash, failed_count, locked_until, updated_at)
  values (p_ip_hash, v_fails, case when v_fails >= 5 then now() + interval '15 minutes' end, now())
  on conflict (ip_hash) do update
     set failed_count = excluded.failed_count,
         locked_until = excluded.locked_until,
         updated_at = now();
  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + interval '15 minutes');
  end if;
  return jsonb_build_object('ok', false, 'reason', 'wrong_pin', 'remaining', 5 - v_fails);
end;
$$;

create or replace function public.admin_set_scanner_pin(p_pin text)
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
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'Die PIN muss aus genau 4 Ziffern bestehen' using errcode = '22023';
  end if;
  update public.settings
     set scanner_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
         scanner_token_version = scanner_token_version + 1
   where id = 1
  returning scanner_token_version into v;
  return v;
end;
$$;
