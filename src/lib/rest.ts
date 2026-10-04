import { env } from './env';

/**
 * Schlanker PostgREST-Aufruf für die öffentliche Seite (statt supabase-js – spart ~150 KB).
 * Das Backoffice nutzt weiterhin supabase-js in seinem eigenen Bundle.
 */
export class RestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function restConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/**
 * Ruft eine freigegebene Datenbankfunktion auf.
 * mode 'single': genau eine Zeile erwartet · 'maybe': eine oder keine (null) · 'many': Liste/Wert.
 */
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
  mode: 'many' | 'single' | 'maybe' = 'many',
): Promise<T | null> {
  if (!restConfigured()) throw new RestError(0, 'Supabase ist nicht konfiguriert');
  const res = await fetch(`${env.supabaseUrl!.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseAnonKey!,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Accept: mode === 'many' ? 'application/json' : 'application/vnd.pgrst.object+json',
    },
    body: JSON.stringify(args),
  });
  // Keine Zeile bei „object“-Antwort → PostgREST meldet 406
  if (mode === 'maybe' && res.status === 406) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new RestError(res.status, body.message ?? `Fehler ${res.status}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}
