-- Follower-Zahl von @diehaendlerdetmold für die Website (additiv).
-- Quelle: Edge Function `instagram-sync` (Instagram Graph API, täglich), sobald die Secrets
-- INSTAGRAM_USER_ID und INSTAGRAM_ACCESS_TOKEN gesetzt sind – sonst im Admin von Hand gepflegt.
alter table public.settings
  add column instagram_followers integer check (instagram_followers >= 0),
  add column instagram_followers_updated_at timestamptz;

create function public.get_instagram_stats()
returns table (followers integer, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.instagram_followers, s.instagram_followers_updated_at
    from public.settings s
   where s.id = 1 and s.instagram_followers is not null;
$$;

revoke execute on function public.get_instagram_stats() from public;
grant execute on function public.get_instagram_stats() to anon, authenticated;

create function public.invoke_instagram_sync()
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
    url := rtrim(v_url, '/') || '/functions/v1/instagram-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.invoke_instagram_sync() from public, anon, authenticated;

select cron.schedule('instagram-sync', '7 */6 * * *', $$select public.invoke_instagram_sync();$$);
