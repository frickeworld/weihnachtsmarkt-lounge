-- =====================================================================================
-- Testdaten zurücksetzen – EINMAL vor dem Livegang (Supabase → SQL Editor)
--
-- Löscht ALLE Buchungen, Scan- und E-Mail-Protokolle, Klickzahlen und Sperrzähler.
-- Einstellungen, Zeitfenster, Zugänge und Scanner-PIN bleiben erhalten.
--
-- Sicherungen:
--   1. Läuft nur, wenn die Bestätigungszeile unten auf 'JA, ALLES LÖSCHEN' steht.
--   2. Bricht ab, sobald die Saison begonnen hat (echte Buchungen wären sonst weg).
--
-- Danach zusätzlich: Supabase → Storage → Bucket „tickets“ → alle Dateien löschen
-- (QR-Code-Bilder der Testbuchungen).
-- =====================================================================================
begin;

-- Bestätigung: Text genau so stehen lassen, sonst passiert nichts.
select set_config('lounge.reset_confirm', 'JA, ALLES LÖSCHEN', true);

do $$
declare
  v_start date;
begin
  if current_setting('lounge.reset_confirm', true) is distinct from 'JA, ALLES LÖSCHEN' then
    raise exception 'Abbruch: Bestätigung fehlt.';
  end if;
  select season_start into v_start from public.settings where id = 1;
  if (now() at time zone 'Europe/Berlin')::date >= v_start then
    raise exception 'Abbruch: Die Saison hat am % begonnen – es könnten echte Buchungen betroffen sein.', v_start;
  end if;

  delete from public.scan_log;
  delete from public.email_log;
  delete from public.bookings;
  delete from public.page_events;
  delete from public.checkout_attempts;
  delete from public.scanner_attempts;

  raise notice 'Testdaten gelöscht. Buchungen übrig: %', (select count(*) from public.bookings);
end;
$$;

-- Optional: Test-Sperren und Test-Schließtage ebenfalls entfernen (Zeilen einkommentieren)
-- delete from public.blocked_slots;
-- delete from public.closed_dates;

commit;
