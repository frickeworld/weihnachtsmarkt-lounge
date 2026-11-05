-- Umsatzsteuer für die Netto-Anzeige im Admin (Entscheidung Louis, 05.11.2026: vorläufig 19 %,
-- endgültig nach Rücksprache mit dem Steuerberater). Nur Anzeige – Preise ändern sich nicht.
alter table public.settings
  add column if not exists vat_percent numeric(4, 1) not null default 19
    check (vat_percent >= 0 and vat_percent < 100);

grant select (vat_percent) on public.settings to authenticated;
grant update (vat_percent) on public.settings to authenticated;
