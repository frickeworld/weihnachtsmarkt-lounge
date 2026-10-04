-- Design-Runde 2: Der Anlass ist bei der Buchung freiwillig.
-- Nicht-destruktiv: Die Spalte bleibt, nur die NOT-NULL-Pflicht entfällt. Der CHECK greift weiter für gesetzte Werte.
alter table public.bookings alter column occasion drop not null;
