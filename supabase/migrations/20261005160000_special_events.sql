-- Sonderveranstaltungen mit Infotext (additiv): Partys, Live-Auftritte.
-- Beschreibung und optionaler Hinweis („Live: Weidmüller“) erscheinen im Abschnitt „Besondere
-- Abende“ und beim Zeitfenster im Buchungskalender.

alter table public.slot_specials
  add column description text check (char_length(description) <= 600),
  add column act text check (char_length(act) <= 80);

comment on column public.slot_specials.description is 'Infotext für die Website (max. 600 Zeichen)';
comment on column public.slot_specials.act is 'Kurzer Zusatz, z. B. „Live: Weidmüller“ (optional)';

-- Öffentlich: kommende Sonderveranstaltungen mit Preis und Belegung (ohne Händler-Anteil).
-- Nur buchbare oder ausgebuchte Termine; gesperrte, geschlossene und vergangene fallen weg.
create function public.get_special_events()
returns table (
  date date,
  start_time time,
  end_time time,
  title text,
  act text,
  description text,
  total_cents integer,
  taler_count integer,
  status text
)
language sql
volatile
security definer
set search_path = ''
as $$
  select sp.date, a.start_time, a.end_time, sp.title, sp.act, sp.description,
         sp.price_cents, sp.taler_count, a.status
    from public.slot_specials sp
    cross join lateral public.get_availability(sp.date, sp.date) a
   where a.start_time = sp.start_time
     and a.status in ('free', 'taken')
     and sp.date >= (now() at time zone 'Europe/Berlin')::date
   order by sp.date, a.start_time;
$$;

revoke execute on function public.get_special_events() from public;
grant execute on function public.get_special_events() to anon, authenticated;
