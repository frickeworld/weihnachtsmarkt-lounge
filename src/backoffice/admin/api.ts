import { FunctionsHttpError } from '@supabase/supabase-js';
import { requireClient } from '../authClient';

export const BOOKING_COLUMNS =
  'id, booking_code, date, start_time, end_time, status, source, payment_method, first_name, last_name, email, phone, persons, occasion, company_name, vat_id, invoice_requested, billing_street, billing_zip, billing_city, notes, newsletter_opt_in, price_cents, fee_cents, haendler_share_cents, amount_total_cents, include_in_settlement, stripe_payment_intent_id, stripe_invoice_url, hold_expires_at, paid_at, checked_in_at, taler_handed_out_at, cancelled_at, cancel_reason, reminder_sent_at, admin_override, anonymized_at, created_at';

export type AdminResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      status: number;
      message: string;
      needsOverride?: boolean;
      fields?: Record<string, string>;
    };

/** Aufruf der Edge Function `admin` (braucht service_role – darum nicht direkt per RPC). */
export async function callAdmin<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<AdminResult<T>> {
  const { data, error } = await requireClient().functions.invoke('admin', {
    body: { action, ...payload },
  });
  if (!error) return { ok: true, ...(data as T) };
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      needsOverride?: boolean;
      fields?: Record<string, string>;
    };
    return {
      ok: false,
      status: res.status,
      message:
        body.message ??
        (res.status === 403 ? 'Keine Berechtigung (2FA nötig).' : 'Die Aktion ist fehlgeschlagen.'),
      needsOverride: body.needsOverride,
      fields: body.fields,
    };
  }
  return { ok: false, status: 0, message: 'Keine Verbindung zum Server.' };
}
