-- Gewinnspiel (Entscheidung Louis, 05.11.2026): bis Samstag 28.11. sammeln, erste Ziehung am
-- 28.11.2026 um 20:00 Uhr, danach wie bisher jeden Sonntag um 18:00 Uhr bis Gewinnspielende.
-- Vor der ersten Ziehung wird nicht gezogen.
alter table public.settings
  add column if not exists giveaway_first_draw_at timestamptz;
grant select (giveaway_first_draw_at) on public.settings to authenticated;
grant update (giveaway_first_draw_at) on public.settings to authenticated;

update public.settings
   set giveaway_first_draw_at = timestamp '2026-11-28 20:00' at time zone 'Europe/Berlin',
       updated_at = now()
 where id = 1;

create or replace function public.next_giveaway_draw()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.settings%rowtype;
  v_now timestamp := now() at time zone 'Europe/Berlin';
  v_from timestamp;
  v_day date;
  v_at timestamp;
begin
  select * into s from public.settings where id = 1;
  if not s.giveaway_active then
    return null;
  end if;
  -- Erste Ziehung steht fest und liegt noch in der Zukunft
  if s.giveaway_first_draw_at is not null and now() < s.giveaway_first_draw_at then
    if (s.giveaway_first_draw_at at time zone 'Europe/Berlin')::date
       > coalesce(s.giveaway_end, s.season_end) then
      return null;
    end if;
    return s.giveaway_first_draw_at;
  end if;
  -- Danach der wöchentliche Termin, frühestens nach der ersten Ziehung
  v_from := greatest(v_now, coalesce(s.giveaway_first_draw_at at time zone 'Europe/Berlin', v_now));
  v_day := v_from::date + ((s.giveaway_draw_isodow - extract(isodow from v_from)::int + 7) % 7);
  v_at := v_day + make_interval(hours => s.giveaway_draw_hour);
  if v_at <= v_from then
    v_at := v_at + interval '7 days';
  end if;
  if v_at::date > coalesce(s.giveaway_end, s.season_end) then
    return null;
  end if;
  return v_at at time zone 'Europe/Berlin';
end;
$$;

-- Stündlich prüfen (nicht mehr nur sonntags); gezogen wird nur zur vollen Stunde der nächsten
-- Ziehung laut next_giveaway_draw() – also am 28.11. um 20 Uhr und danach sonntags um 18 Uhr.
create or replace function public.invoke_giveaway_draw()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.settings%rowtype;
  v_now timestamptz := now();
  v_due timestamptz;
  v_url text;
  v_secret text;
begin
  select * into s from public.settings where id = 1;
  if not s.giveaway_active then
    return;
  end if;
  -- Fällig ist die Ziehung, deren Stunde gerade läuft (Cron läuft zur vollen Stunde).
  v_due := case
    when s.giveaway_first_draw_at is not null
         and date_trunc('hour', v_now) = date_trunc('hour', s.giveaway_first_draw_at)
      then s.giveaway_first_draw_at
    when (s.giveaway_first_draw_at is null or v_now > s.giveaway_first_draw_at + interval '1 hour')
         and extract(isodow from v_now at time zone 'Europe/Berlin')::int = s.giveaway_draw_isodow
         and extract(hour from v_now at time zone 'Europe/Berlin')::int = s.giveaway_draw_hour
      then v_now
  end;
  if v_due is null
     or (v_now at time zone 'Europe/Berlin')::date > coalesce(s.giveaway_end, s.season_end) then
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

select cron.schedule('giveaway-draw', '0 * * * *', $$select public.invoke_giveaway_draw();$$);
