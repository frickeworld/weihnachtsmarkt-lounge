// Scanner-Token: HMAC-SHA256-signiert, 12 Stunden gültig, enthält die scanner_token_version.
// Eine neue PIN im Admin erhöht die Version → alle ausgegebenen Tokens werden ungültig.

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const SCANNER_TOKEN_HOURS = 12;

export interface ScannerClaims {
  v: number;
  iat: number;
  exp: number;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signScannerToken(
  secret: string,
  version: number,
  now = Date.now(),
): Promise<string> {
  const iat = Math.floor(now / 1000);
  const claims: ScannerClaims = { v: version, iat, exp: iat + SCANNER_TOKEN_HOURS * 3600 };
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** Prüft Signatur, Ablauf und Version. null = ungültig. */
export async function verifyScannerToken(
  secret: string,
  token: string,
  currentVersion: number,
  now = Date.now(),
): Promise<ScannerClaims | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await key(secret),
      fromB64url(sig) as Uint8Array<ArrayBuffer>,
      enc.encode(body),
    );
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as ScannerClaims;
    if (claims.exp * 1000 <= now || claims.v !== currentVersion) return null;
    return claims;
  } catch {
    return null;
  }
}
