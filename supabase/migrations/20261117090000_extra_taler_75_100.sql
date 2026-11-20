-- Extra-Taler-Stufen 75 oder 100 Taler (Entscheidung Louis, 17.11.2026; vorher 100/200/300).
-- Nur Standardwert und aktuelle Einstellung, im Admin weiterhin änderbar.
alter table public.settings alter column extra_taler_options set default '{75,100}';
update public.settings set extra_taler_options = '{75,100}', updated_at = now() where id = 1;
