/** Öffentliche Laufzeit-Konfiguration. Hier dürfen nur nicht-geheime Werte stehen. */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  publicSiteUrl:
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? window.location.origin,
};
