-- =====================================================================================
-- Programm des Weihnachtsmarkts für die Startseite (Entscheidung Louis, 04.11.2026), nur additiv.
-- Reine Anzeige: Die Lounge-Zeitfenster und Preise des Abends kommen weiter aus slot_pricing();
-- Programmpunkte ändern keine Preise und sind keine Sonderveranstaltungen (Gewinnspiel-Codes
-- gelten an diesen Abenden). Quelle: Programmheft 2026 (Korrekturabzug 03.11.), Freitags- und
-- Samstags-Acts ab 17 Uhr auf Winterbühne und Frickes Tanzfläche – ohne Kinder- und
-- Schlossprogramm und ohne Stadthalle mit eigenem Ticket.
-- =====================================================================================

create table public.market_program (
  id bigint generated always as identity primary key,
  date date not null,
  start_time time not null,
  end_time time,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 400),
  location text check (char_length(location) <= 80),
  created_at timestamptz not null default now(),
  unique (date, start_time, title)
);
comment on table public.market_program is
  'Programmpunkte des Weihnachtsmarkts zur Anzeige bei „Partys und besondere Abende“ (keine Preise).';

alter table public.market_program enable row level security;
revoke all on public.market_program from anon, authenticated;
grant select, insert, update, delete on public.market_program to authenticated;
create policy "admin verwaltet market_program" on public.market_program
  for all to authenticated using (public.is_admin_aal2()) with check (public.is_admin_aal2());

-- Öffentlich: kommende Programmpunkte (ab heute, Berliner Zeit) innerhalb der Saison.
create function public.get_market_program()
returns table (
  date date,
  start_time time,
  end_time time,
  title text,
  description text,
  location text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.date, p.start_time, p.end_time, p.title, p.description, p.location
    from public.market_program p, public.settings s
   where s.id = 1
     and p.date >= (now() at time zone 'Europe/Berlin')::date
     and p.date between s.season_start and s.season_end
   order by p.date, p.start_time;
$$;
revoke execute on function public.get_market_program() from public;
grant execute on function public.get_market_program() to anon, authenticated;

insert into public.market_program (date, start_time, end_time, title, description, location) values
  ('2026-12-04', '18:30', '19:30', 'Tanzworkshop Langsamer Walzer',
   'Kostenloser Workshop von Anfänger bis Fortgeschrittene, präsentiert von der Tanzschule Fricke',
   'Frickes Tanzfläche'),
  ('2026-12-04', '19:30', '20:30', 'Paartanzabend – Ballroom Night',
   'Von klassisch bis Cha-Cha-Cha, präsentiert von der Tanzschule Fricke', 'Frickes Tanzfläche'),
  ('2026-12-04', '20:30', '21:45', 'Discofox All Night Long',
   'Präsentiert von der Tanzschule Fricke', 'Frickes Tanzfläche'),
  ('2026-12-05', '17:00', null, 'My Christmas DAY DÄNZiNG',
   'DJ ElectroArt Jens Naumann, präsentiert von der Cosmo Lounge', 'Winterbühne'),
  ('2026-12-05', '19:00', null, 'Indian Motorcycle Band',
   'Handgemachter Rhythm & Blues, präsentiert von der Cosmo Lounge', 'Winterbühne'),
  ('2026-12-11', '19:00', null, 'Phil Solo',
   'Singer-Songwriter, präsentiert von der Werbegemeinschaft Detmold e. V.', 'Winterbühne'),
  ('2026-12-12', '17:00', null, 'Tanzsport Fröse', null, 'Winterbühne'),
  ('2026-12-12', '19:00', null, 'Marzena & Manuel',
   'Acoustic Pop, präsentiert von der Cosmo Lounge', 'Winterbühne'),
  ('2026-12-18', '17:00', null, 'Musiktheaterstudio Inspiration', null, 'Winterbühne'),
  ('2026-12-18', '19:00', null, '4 Souls',
   'Die besten Cover-Songs aus Soul, Pop, Rock & Schlager, präsentiert von der Cosmo Lounge',
   'Winterbühne'),
  ('2026-12-19', '19:00', null, '4 Souls',
   'Die besten Cover-Songs aus Soul, Pop, Rock & Schlager, präsentiert von der Cosmo Lounge',
   'Winterbühne')
on conflict do nothing;
