import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './http.ts';

/** Server-Client mit service_role. Nur in Edge Functions verwenden – nie im Browser. */
export function adminClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface SettingsRow {
  price_cents: number;
  fee_cents: number;
  taler_count: number;
  taler_cents: number;
  haendler_share_cents: number;
  max_persons: number;
  hold_minutes: number;
  booking_cutoff_minutes: number;
}
