-- Warteliste für ausgebuchte Tage (additiv).
-- Gäste tragen sich über die Edge Function `waitlist` ein (nur E-Mail + Tag, mit Einwilligung).
-- Wird an dem Tag ein Zeitfenster frei, verschickt `send-waitlist` genau eine Mail und löscht
-- den Eintrag. Einträge für vergangene Tage werden täglich gelöscht.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (date, email)
);
comment on table public.waitlist is
  'Warteliste je Tag. Einmalige Benachrichtigung, danach gelöscht. Keine Werbung.';

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant select on public.waitlist to authenticated;
-- Admin sieht Einträge (Anzahl je Tag), Gäste und Händler nicht.
create policy "admin liest waitlist" on public.waitlist
  for select to authenticated using (public.is_admin_aal2());

-- Fällige Benachrichtigungen reservieren: Einträge mit freiem Zeitfenster am Wunschtag.
-- Nicht abgeschlossene Reservierungen werden nach 30 Minuten erneut vergeben.
create function public.claim_waitlist_notifications(p_limit integer default 50)
returns table (id uuid, date date, email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  return query
  with due as (
    select w.id
      from public.waitlist w
     where w.date >= v_today
       and (w.claimed_at is null or w.claimed_at < now() - interval '30 minutes')
       and exists (
         select 1 from public.get_availability(w.date, w.date) a where a.status = 'free'
       )
     order by w.created_at
     limit p_limit
     for update skip locked
  )
  update public.waitlist w
     set claimed_at = now()
    from due
   where w.id = due.id
  returning w.id, w.date, w.email;
end;
$$;

revoke execute on function public.claim_waitlist_notifications(integer) from public, anon, authenticated;

create function public.invoke_send_waitlist()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  -- Nur aufrufen, wenn es überhaupt Einträge gibt
  if not exists (
    select 1 from public.waitlist where date >= (now() at time zone 'Europe/Berlin')::date
  ) then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-waitlist',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.invoke_send_waitlist() from public, anon, authenticated;

select cron.schedule(
  'send-waitlist',
  '*/10 * * * *',
  $$select public.invoke_send_waitlist();$$
);

select cron.schedule(
  'cleanup-waitlist',
  '23 3 * * *',
  $$delete from public.waitlist where date < (now() at time zone 'Europe/Berlin')::date;$$
);
