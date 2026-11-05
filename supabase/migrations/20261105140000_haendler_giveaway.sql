-- Händler sehen das Gewinnspiel (nur lesen, Entscheidung Louis, 05.11.2026): Status, Teilnehmer-
-- zahlen, Ziehungen mit Vorname und Initial des Gewinners, eingelöste Codes. Keine E-Mails.
create function public.haendler_giveaway_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.settings%rowtype;
begin
  perform public.assert_haendler_or_admin();
  select * into s from public.settings where id = 1;
  return jsonb_build_object(
    'active', s.giveaway_active,
    'end', s.giveaway_end,
    'discount_percent', s.giveaway_discount_percent,
    'next_draw', public.next_giveaway_draw(),
    'entries_confirmed', (select count(*) from public.giveaway_entries
                           where confirmed_at is not null and unsubscribed_at is null),
    'entries_pending', (select count(*) from public.giveaway_entries where confirmed_at is null),
    'referrals', (select count(*) from public.giveaway_entries
                   where referred_by is not null and confirmed_at is not null),
    'codes_redeemed', (select count(*) from public.bookings
                        where discount_code is not null and status = 'paid'),
    'draws', coalesce((
      select jsonb_agg(jsonb_build_object(
               'drawn_at', d.drawn_at,
               'pool_size', d.pool_size,
               'lots', d.lots,
               'winner', case when e.id is null then null
                              else e.first_name || ' ' || left(e.last_name, 1) || '.' end)
             order by d.id desc)
        from public.giveaway_draws d
        left join public.giveaway_entries e on e.id = d.winner_entry_id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.haendler_giveaway_summary() from public, anon;
grant execute on function public.haendler_giveaway_summary() to authenticated;
