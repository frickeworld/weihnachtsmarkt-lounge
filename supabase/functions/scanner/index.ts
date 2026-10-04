// scanner: Einlass-Scanner ohne Konto. Aktionen (POST JSON):
//   auth  { pin }                                   → { token, expiresAt }
//   today { token }                                 → Liste „Heute“ (für Anzeige und Offline-Prüfung)
//   scan  { token, code, override?, scannedAt?, offline? } → Ergebnis grün/gelb/orange/rot
//   taler { token, bookingId, scannedAt?, offline? }       → Residenztaler übergeben
import { adminClient } from '../_shared/db.ts';
import { hashClientIp, json, preflight } from '../_shared/http.ts';
import { signScannerToken, verifyScannerToken } from '../_shared/scannerToken.ts';

function secret(): string {
  const s = Deno.env.get('SCANNER_TOKEN_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!s) throw new Error('Secret SCANNER_TOKEN_SECRET fehlt');
  return s;
}

const isoOrNull = (v: unknown) =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = adminClient();

  if (body.action === 'auth') {
    const { data, error } = await db.rpc('scanner_check_pin', {
      p_ip_hash: await hashClientIp(req),
      p_pin: String(body.pin ?? ''),
    });
    if (error) return json({ error: 'server' }, 500);
    const r = data as {
      ok: boolean;
      reason?: string;
      version?: number;
      remaining?: number;
      locked_until?: string;
    };
    if (!r.ok) {
      const message =
        r.reason === 'locked'
          ? 'Zu viele Fehlversuche. Bitte warte 10 Minuten.'
          : r.reason === 'no_pin'
            ? 'Der Scanner ist noch nicht freigeschaltet. Studio F legt die PIN im Admin fest.'
            : `PIN falsch. Noch ${r.remaining} ${r.remaining === 1 ? 'Versuch' : 'Versuche'}.`;
      return json(
        { error: r.reason, message, lockedUntil: r.locked_until ?? null },
        r.reason === 'locked' ? 429 : 401,
      );
    }
    const token = await signScannerToken(secret(), r.version!);
    const exp = JSON.parse(atob(token.split('.')[0]!.replace(/-/g, '+').replace(/_/g, '/')))
      .exp as number;
    return json({ token, expiresAt: new Date(exp * 1000).toISOString() });
  }

  // Alle anderen Aktionen brauchen ein gültiges Token mit aktueller Version.
  const { data: version } = await db.rpc('scanner_token_version');
  const claims =
    typeof body.token === 'string' && typeof version === 'number'
      ? await verifyScannerToken(secret(), body.token, version)
      : null;
  if (!claims) return json({ error: 'auth', message: 'Bitte melde dich mit der PIN neu an.' }, 401);

  const scannedAt = isoOrNull(body.scannedAt);
  const offline = body.offline === true;

  switch (body.action) {
    case 'today': {
      const { data, error } = await db.rpc('scanner_today');
      return error ? json({ error: 'server' }, 500) : json(data);
    }
    case 'scan': {
      const code = String(body.code ?? '').slice(0, 64);
      if (!code.trim()) return json({ error: 'code' }, 400);
      const { data, error } = await db.rpc('scanner_scan', {
        p_code: code,
        p_override: body.override === true,
        p_scanned_at: scannedAt,
        p_offline: offline,
      });
      return error ? json({ error: 'server' }, 500) : json(data);
    }
    case 'taler': {
      const id = String(body.bookingId ?? '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'booking' }, 400);
      const { data, error } = await db.rpc('scanner_taler', {
        p_booking_id: id,
        p_scanned_at: scannedAt,
        p_offline: offline,
      });
      return error ? json({ error: 'server' }, 500) : json(data);
    }
    default:
      return json({ error: 'unknown_action' }, 400);
  }
});
