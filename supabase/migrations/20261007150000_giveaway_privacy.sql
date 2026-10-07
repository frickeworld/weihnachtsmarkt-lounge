-- Gewinnspiel-Daten sparsam halten (additiv), wie in der Datenschutzerklärung beschrieben:
--  * unbestätigte Anmeldungen werden nach 30 Tagen gelöscht (täglich, pg_cron)
--  * nach der Saison anonymisiert die Datenpflege im Admin alle Teilnehmer (Statistik bleibt)

select cron.schedule(
  'cleanup-giveaway-unconfirmed',
  '41 3 * * *',
  $$delete from public.giveaway_entries
     where confirmed_at is null and created_at < now() - interval '30 days'$$
);

create function public.admin_anonymize_giveaway()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.assert_admin();
  update public.giveaway_entries
     set email = 'anonymisiert-' || id || '@invalid',
         first_name = 'Anonymisiert',
         last_name = '–',
         company = null,
         anonymized_at = now()
   where anonymized_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.admin_anonymize_giveaway() from public, anon;
grant execute on function public.admin_anonymize_giveaway() to authenticated;
