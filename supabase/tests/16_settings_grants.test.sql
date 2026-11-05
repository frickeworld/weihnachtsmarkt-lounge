-- Spaltenrechte auf settings: Jede neue Spalte muss für Admins lesbar sein (sonst „Keine
-- Berechtigung“ im Admin). Nur PIN-Hash und Token-Version bleiben gesperrt.
begin;
select plan(4);

select is_empty(
  $$select column_name::text from information_schema.columns
     where table_schema = 'public' and table_name = 'settings'
       and column_name not in ('scanner_pin_hash', 'scanner_token_version')
       and not has_column_privilege('authenticated', 'public.settings', column_name, 'SELECT')$$,
  'alle settings-Spalten außer PIN-Hash/Version sind für authenticated lesbar');

select ok(
  not has_column_privilege('authenticated', 'public.settings', 'scanner_pin_hash', 'SELECT')
  and not has_column_privilege('authenticated', 'public.settings', 'scanner_token_version', 'SELECT'),
  'PIN-Hash und Token-Version bleiben gesperrt');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'admin2@test.de');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c1', 'studio_admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal2"}';

-- Genau die Abfragen aus Kalender, Einstellungen, Gewinnspiel, Tagesbericht, Instagram
select lives_ok($$select season_start, season_end, price_cents, fee_cents, fee_percent, studio_share_percent,
  taler_count, taler_cents, haendler_share_cents, max_persons, booking_cutoff_minutes, hold_minutes,
  checkin_early_minutes, contact_email, lounge_location, updated_at, giveaway_active, giveaway_end,
  giveaway_discount_percent, daily_report_recipients, instagram_followers, instagram_followers_updated_at
  from public.settings where id = 1$$, 'Admin mit 2FA liest alle Einstellungen');
select lives_ok($$update public.settings set giveaway_active = giveaway_active, fee_percent = fee_percent,
  studio_share_percent = studio_share_percent, daily_report_recipients = daily_report_recipients,
  instagram_followers = instagram_followers where id = 1$$, 'Admin mit 2FA ändert neue Einstellungen');

select * from finish();
rollback;
