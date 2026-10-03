-- =====================================================================================
-- Phase 4: Ticket, E-Mails, Erinnerung
-- =====================================================================================

-- Ort der Lounge für Ticket-Mail und PDF (im Admin pflegbar, Phase 5).
alter table public.settings
  add column if not exists lounge_location text not null
    default 'Weihnachtsmarkt im Schlosspark Detmold, direkt am Residenzschloss. [GENAUE POSITION]';

-- Öffentlicher Speicher für QR-Codes. Dateiname = ticket_token (32 Zeichen, nicht erratbar).
-- Schreiben nur mit service_role (Edge Functions), daher keine Insert-Policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', true, 524288, array['image/png'])
on conflict (id) do nothing;

-- Online-Ticket /ticket/[token]: nur die nötigen Felder, keine Kontaktdaten.
create function public.get_ticket(p_token text)
returns table (
  first_name text,
  booking_code text,
  slot_date date,
  start_time time,
  end_time time,
  persons integer,
  status text,
  checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.first_name, b.booking_code, b.date, b.start_time, b.end_time, b.persons,
         b.status, b.checked_in_at
    from public.bookings b
   where p_token ~ '^[A-Za-z0-9]{32}$'
     and b.ticket_token = p_token
     and b.status in ('paid', 'cancelled')
   limit 1;
$$;

revoke execute on function public.get_ticket(text) from public;
grant execute on function public.get_ticket(text) to anon, authenticated;

-- Erinnerungen am Buchungstag ab 10:00 Uhr (Europe/Berlin).
-- Reserviert die fälligen Buchungen atomar (reminder_sent_at), damit nie doppelt verschickt wird.
-- Wer erst nach 10:00 Uhr am selben Tag gebucht hat, bekommt keine Erinnerung (Ticket ist frisch).
create function public.claim_due_reminders(p_limit integer default 50, p_now timestamptz default now())
returns setof uuid
language sql
volatile
security definer
set search_path = ''
as $$
  with berlin as (
    select (p_now at time zone 'Europe/Berlin') as local_now
  ),
  due as (
    select b.id
      from public.bookings b, berlin
     where b.status = 'paid'
       and b.reminder_sent_at is null
       and b.date = berlin.local_now::date
       and berlin.local_now::time >= time '10:00'
       and b.created_at < ((berlin.local_now::date + time '10:00') at time zone 'Europe/Berlin')
       and public.slot_starts_at(b.date, b.start_time) > p_now
     order by b.start_time
     limit p_limit
     for update skip locked
  )
  update public.bookings b
     set reminder_sent_at = p_now
    from due
   where b.id = due.id
  returning b.id;
$$;

-- Falls der Versand scheitert: Reservierung zurücknehmen, damit der nächste Lauf es erneut versucht.
create function public.release_reminder_claim(p_booking_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.bookings set reminder_sent_at = null where id = p_booking_id;
$$;

revoke execute on function public.claim_due_reminders(integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.release_reminder_claim(uuid) from public, anon, authenticated;

-- Zeitplan: alle 15 Minuten send-reminders aufrufen (verschickt nur, was fällig ist).
-- URL und Geheimnis liegen im Supabase Vault (einmalig per SQL anlegen, siehe docs/SETUP.md):
--   project_url  = https://[PROJEKT-REF].supabase.co
--   cron_secret  = derselbe Wert wie das Function-Secret CRON_SECRET
-- Fehlen die Einträge, macht der Job nichts.
create extension if not exists pg_net with schema extensions;

create function public.invoke_send_reminders()
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
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.invoke_send_reminders() from public, anon, authenticated;

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$select public.invoke_send_reminders();$$
);
