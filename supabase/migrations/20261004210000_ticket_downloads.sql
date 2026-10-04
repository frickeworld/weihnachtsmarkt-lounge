-- =====================================================================================
-- Ticket-Downloads (PDF, Apple Wallet, Google Wallet) und Standorttext
-- Nur additiv: neue Funktion, Standardwert und Platzhalter-Text ersetzt.
-- =====================================================================================

-- Standort (Louis, 04.10.2026): Weihnachtsmarkt im Schlosspark Detmold.
alter table public.settings
  alter column lounge_location set default 'Weihnachtsmarkt im Schlosspark, Detmold';
update public.settings
   set lounge_location = 'Weihnachtsmarkt im Schlosspark, Detmold'
 where lounge_location like '%[GENAUE POSITION]%';

-- Erfolgsseite: Ticket-Token für „PDF herunterladen“ und Wallet – nur für bezahlte Buchungen.
-- Die Stripe-Session-ID kennt nur, wer gerade bezahlt hat (Rücksprung-URL von Stripe).
create function public.get_success_ticket_token(p_session_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select b.ticket_token
    from public.bookings b
   where p_session_id like 'cs\_%'
     and b.stripe_checkout_session_id = p_session_id
     and b.status = 'paid'
     and b.anonymized_at is null
   limit 1;
$$;

revoke execute on function public.get_success_ticket_token(text) from public;
grant execute on function public.get_success_ticket_token(text) to anon, authenticated;
