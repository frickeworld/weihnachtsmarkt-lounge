import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Client für angemeldete Nutzer (Admin, Händler). Wird nur im Backoffice-Bundle geladen.
 * Die Sitzung liegt im localStorage des Geräts – nötig, damit Einladungs- und Passwort-Links
 * (Token im URL-Hash) und die 2FA-Abfrage funktionieren. Kein Tracking.
 */
export const authClient: SupabaseClient | null =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
          storageKey: 'lounge-backoffice-auth',
        },
      })
    : null;

export function requireClient(): SupabaseClient {
  if (!authClient) throw new Error('Supabase ist nicht konfiguriert.');
  return authClient;
}

/** Ziel-URL für Einladungen und „Passwort vergessen“. */
export function newPasswordUrl(): string {
  return `${env.publicSiteUrl.replace(/\/$/, '')}/login/neues-passwort`;
}
