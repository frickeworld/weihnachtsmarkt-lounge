-- Reservierungen, deren 30 Minuten abgelaufen sind, alle 5 Minuten freigeben.
-- (Zusätzlich ruft get_availability() und create-checkout die Funktion vor jeder Abfrage auf.)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'expire-stale-holds',
  '*/5 * * * *',
  $$select public.expire_stale_holds();$$
);
