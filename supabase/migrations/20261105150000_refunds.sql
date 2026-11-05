-- Storno mit Erstattung über Stripe (Entscheidung Louis, 05.11.2026): Beim Stornieren wählt der
-- Admin „alles“, „ohne Verarbeitungsgebühr“ oder „keine Erstattung“. Die Erstattung löst die Edge
-- Function `admin` aus; hier wird nur festgehalten, was erstattet wurde.
alter table public.bookings
  add column if not exists refund_cents integer check (refund_cents is null or refund_cents >= 0),
  add column if not exists refunded_at timestamptz,
  add column if not exists stripe_refund_id text;
