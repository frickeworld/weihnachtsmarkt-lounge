// Wallet-Zugangsdaten aus den Supabase-Secrets. Fehlen sie, gibt es nur PDF und Online-Ticket.

export interface AppleWalletConfig {
  passTypeId: string;
  teamId: string;
  certPem: string;
  keyPem: string;
  keyPassword: string | null;
  wwdrPem: string;
}

export interface GoogleWalletConfig {
  issuerId: string;
  clientEmail: string;
  privateKeyPem: string;
  apiBase: string;
  tokenUrl: string;
}

/** Ungefähre Lage der Lounge (Schlosspark Detmold) – lässt das Ticket in der Nähe auf dem Sperrbildschirm erscheinen. */
export const LOUNGE_COORDINATES = { latitude: 51.9389, longitude: 8.8786 };

const env = (name: string) => Deno.env.get(name)?.trim() || null;

/** PEM direkt (auch mit \n-Escapes) oder base64-kodiert. */
export function readPem(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('-----')) return value.replace(/\\n/g, '\n');
  try {
    const decoded = atob(value);
    return decoded.startsWith('-----') ? decoded : null;
  } catch {
    return null;
  }
}

export function appleWalletConfig(): AppleWalletConfig | null {
  const passTypeId = env('APPLE_PASS_TYPE_ID');
  const teamId = env('APPLE_TEAM_ID');
  const certPem = readPem(env('APPLE_PASS_CERT'));
  const keyPem = readPem(env('APPLE_PASS_KEY'));
  const wwdrPem = readPem(env('APPLE_WWDR_CERT'));
  if (!passTypeId || !teamId || !certPem || !keyPem || !wwdrPem) return null;
  return {
    passTypeId,
    teamId,
    certPem,
    keyPem,
    wwdrPem,
    keyPassword: env('APPLE_PASS_KEY_PASSWORD'),
  };
}

export function googleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = env('GOOGLE_WALLET_ISSUER_ID');
  const raw = env('GOOGLE_WALLET_SERVICE_ACCOUNT');
  if (!issuerId || !raw) return null;
  try {
    const json = JSON.parse(raw.startsWith('{') ? raw : atob(raw)) as {
      client_email?: string;
      private_key?: string;
    };
    if (!json.client_email || !json.private_key) return null;
    return {
      issuerId,
      clientEmail: json.client_email,
      privateKeyPem: json.private_key,
      apiBase:
        env('GOOGLE_WALLET_API_BASE') ?? 'https://walletobjects.googleapis.com/walletobjects/v1',
      tokenUrl: env('GOOGLE_OAUTH_TOKEN_URL') ?? 'https://oauth2.googleapis.com/token',
    };
  } catch {
    return null;
  }
}

export function walletAvailability(): { apple: boolean; google: boolean } {
  return { apple: appleWalletConfig() !== null, google: googleWalletConfig() !== null };
}
