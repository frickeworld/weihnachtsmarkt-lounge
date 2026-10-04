/** Supabase-/PostgREST-Fehler in eine verständliche Meldung übersetzen. */
export function errorText(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return 'Unbekannter Fehler.';
  if (e.code === '42501') return 'Keine Berechtigung. Bitte melde dich mit 2FA neu an.';
  if (e.code === '23505') return 'Diesen Eintrag gibt es schon.';
  return e.message || 'Unbekannter Fehler.';
}
