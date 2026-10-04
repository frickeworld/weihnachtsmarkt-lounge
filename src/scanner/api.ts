import { env } from '@/lib/env';
import type { ScanResult, ScanBooking, TodayList } from './types';

/** Kein Netz (Fetch fehlgeschlagen) – der Scanner arbeitet dann offline weiter. */
export class OfflineError extends Error {}
/** Token abgelaufen oder PIN geändert – zurück zur PIN-Eingabe. */
export class AuthError extends Error {}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${(env.supabaseUrl ?? '').replace(/\/$/, '')}/functions/v1/scanner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey ?? '',
        Authorization: `Bearer ${env.supabaseAnonKey ?? ''}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new OfflineError('offline');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (res.status === 401 && body.action !== 'auth') throw new AuthError(data.message ?? 'auth');
  if (!res.ok && body.action !== 'auth') throw new Error(data.message ?? `Fehler ${res.status}`);
  if (!res.ok)
    throw Object.assign(new Error(data.message ?? 'PIN falsch.'), { status: res.status });
  return data;
}

export const scannerApi = {
  auth: (pin: string) => call<{ token: string; expiresAt: string }>({ action: 'auth', pin }),
  today: (token: string) => call<TodayList>({ action: 'today', token }),
  scan: (token: string, code: string, override = false, offline = false, scannedAt?: string) =>
    call<ScanResult>({ action: 'scan', token, code, override, offline, scannedAt }),
  taler: (token: string, bookingId: string, offline = false, scannedAt?: string) =>
    call<{ ok: boolean; already?: boolean; booking?: ScanBooking }>({
      action: 'taler',
      token,
      bookingId,
      offline,
      scannedAt,
    }),
};
