-- Tagesbericht per Mail an Studio F (additiv). Läuft morgens um 7:45 Berliner Zeit während
-- der Saison (eine Woche vorher bis einen Tag danach). Jeder Tag wird höchstens einmal gesendet.
alter table public.settings
  add column daily_report_recipients text[] not null default '{}'::text[];
comment on column public.settings.daily_report_recipients is
  'Zusätzliche Empfänger des Tagesberichts (neben contact_email), z. B. Händler';

create table public.daily_reports (
  day date primary key,
  sent_at timestamptz not null default now()
);
alter table public.daily_reports enable row level security;
revoke all on public.daily_reports from anon, authenticated;
grant select on public.daily_reports to authenticated;
create policy "admin liest daily_reports" on public.daily_reports
  for select to authenticated using (public.is_admin_aal2());

-- Inhalt des Berichts für einen Tag (nur serverseitig).
create function public.daily_report_data(p_day date)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  with s as (select * from public.settings where id = 1)
  select jsonb_build_object(
    'day', p_day,
    'in_season', p_day between (select season_start - 7 from s) and (select season_end + 1 from s),
    'yesterday_count', (
      select count(*) from public.bookings
       where status = 'paid' and (paid_at at time zone 'Europe/Berlin')::date = p_day - 1
    ),
    'yesterday_cents', (
      select coalesce(sum(amount_total_cents), 0) from public.bookings
       where status = 'paid' and (paid_at at time zone 'Europe/Berlin')::date = p_day - 1
    ),
    'today', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'start_time', to_char(b.start_time, 'HH24:MI'),
        'end_time', to_char(b.end_time, 'HH24:MI'),
        'name', b.first_name || ' ' || b.last_name,
        'company', b.company_name,
        'persons', b.persons,
        'occasion', b.occasion,
        'notes', b.notes,
        'booking_code', b.booking_code
      ) order by b.start_time), '[]'::jsonb)
        from public.bookings b
       where b.status = 'paid' and b.date = p_day
    ),
    'free_next_7', (
      select count(*) from public.get_availability(p_day, p_day + 6) a where a.status = 'free'
    ),
    'offered_next_7', (
      select count(*) from public.get_availability(p_day, p_day + 6) a
       where a.status in ('free', 'taken')
    ),
    'waitlist', (select count(*) from public.waitlist where date >= p_day),
    'recipients', (
      select to_jsonb(array(select distinct x from unnest(array[s.contact_email] || s.daily_report_recipients) x where x <> ''))
        from s
    )
  );
$$;
revoke execute on function public.daily_report_data(date) from public, anon, authenticated;

create function public.invoke_daily_report()
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
  -- Nur um 7 Uhr Berliner Zeit (der Zeitplan läuft in UTC zweimal, damit Sommer-/Winterzeit passt)
  if extract(hour from now() at time zone 'Europe/Berlin') <> 7 then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/daily-report',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function public.invoke_daily_report() from public, anon, authenticated;

select cron.schedule('daily-report', '45 5,6 * * *', $$select public.invoke_daily_report();$$);
