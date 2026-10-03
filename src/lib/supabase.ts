import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase-Client mit dem öffentlichen anon-Key. Alle öffentlichen Abfragen laufen über
 * freigegebene Funktionen (RPC). Ohne Konfiguration ist der Client null – die Seite zeigt
 * dann einen Hinweis statt erfundener Verfügbarkeit.
 */
export const supabase: SupabaseClient | null =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;
