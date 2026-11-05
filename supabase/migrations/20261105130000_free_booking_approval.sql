-- Manuelle Buchungen nur noch kostenlos (Entscheidung Louis, 05.11.2026: keine Bar- oder
-- Überweisungsbuchungen mehr). Jede kostenlose Buchung braucht eine Absprache-Notiz
-- (mit Tanzschule Fricke und den Händlern). Bestehende Buchungen bleiben unverändert.
alter table public.bookings add column if not exists approval_note text
  check (approval_note is null or char_length(approval_note) <= 200);

