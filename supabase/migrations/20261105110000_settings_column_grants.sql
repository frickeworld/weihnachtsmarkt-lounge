-- Fix: Spalten, die nach Phase 3 zu public.settings hinzukamen, waren für Admins nicht
-- freigegeben (Spaltenrechte). Folge im Admin: „Keine Berechtigung“ bei Kalender, Einstellungen,
-- Gewinnspiel, Tagesbericht und Instagram. Lesen/Schreiben bleibt per RLS auf Admins mit 2FA
-- beschränkt (Policy „admin verwaltet settings“). PIN-Hash und Token-Version bleiben gesperrt.
grant select (
  instagram_followers, instagram_followers_updated_at, daily_report_recipients,
  giveaway_active, giveaway_end, giveaway_discount_percent, fee_percent,
  giveaway_draw_isodow, giveaway_draw_hour, giveaway_code_hours, studio_share_percent
) on public.settings to authenticated;

grant update (
  instagram_followers, instagram_followers_updated_at, daily_report_recipients,
  giveaway_active, giveaway_end, giveaway_discount_percent, fee_percent,
  giveaway_draw_isodow, giveaway_draw_hour, giveaway_code_hours, studio_share_percent
) on public.settings to authenticated;
