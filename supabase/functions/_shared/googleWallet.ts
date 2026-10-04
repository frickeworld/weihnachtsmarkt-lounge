// Google Wallet: Klasse pro Zeitfenster (per REST angelegt), Ticket-Objekt im signierten „Save“-Link.
// An Google gehen nur Termin, Buchungscode, Personenzahl und QR-Inhalt – keine Namen oder Kontaktdaten.
import { berlinIso } from './format.ts';
import type { GoogleWalletConfig } from './walletConfig.ts';
import { LOUNGE_COORDINATES } from './walletConfig.ts';

export interface GoogleTicketData {
  bookingId: string;
  token: string;
  bookingCode: string;
  date: string;
  startTime: string;
  endTime: string;
  persons: number;
  talerCount: number;
  location: string;
  siteUrl: string;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const b64urlJson = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function signJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const head = b64urlJson({ alg: 'RS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const key = await importKey(privateKeyPem);
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`)),
  );
  return `${head}.${body}.${b64url(sig)}`;
}

let cachedToken: { value: string; exp: number } | null = null;
const knownClasses = new Set<string>();

async function accessToken(cfg: GoogleWalletConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.value;
  const assertion = await signJwt(
    {
      iss: cfg.clientEmail,
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: cfg.tokenUrl,
      iat: now,
      exp: now + 3600,
    },
    cfg.privateKeyPem,
  );
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

const de = (value: string) => ({ defaultValue: { language: 'de-DE', value } });

export function classId(
  cfg: GoogleWalletConfig,
  d: Pick<GoogleTicketData, 'date' | 'startTime'>,
): string {
  return `${cfg.issuerId}.lounge_${d.date.replace(/-/g, '')}_${d.startTime.replace(':', '')}`;
}

export function buildEventClass(cfg: GoogleWalletConfig, d: GoogleTicketData) {
  const site = d.siteUrl.replace(/\/$/, '');
  return {
    id: classId(cfg, d),
    issuerName: 'Weihnachtsmarkt-Lounge der Händler',
    reviewStatus: 'UNDER_REVIEW',
    eventName: de(`Weihnachtsmarkt-Lounge · ${d.startTime}–${d.endTime} Uhr`),
    venue: { name: de('Weihnachtsmarkt im Schlosspark'), address: de(d.location) },
    dateTime: { start: berlinIso(d.date, d.startTime), end: berlinIso(d.date, d.endTime) },
    logo: {
      sourceUri: { uri: `${site}/wallet/google-logo.png` },
      contentDescription: de('Die Händler'),
    },
    heroImage: {
      sourceUri: { uri: `${site}/wallet/google-hero.jpg` },
      contentDescription: de('Weihnachtsmarkt Detmold'),
    },
    hexBackgroundColor: '#24221E',
    locations: [LOUNGE_COORDINATES],
    homepageUri: { uri: site, description: 'Weihnachtsmarkt-Lounge' },
  };
}

export function buildEventObject(cfg: GoogleWalletConfig, d: GoogleTicketData) {
  return {
    id: `${cfg.issuerId}.${d.bookingId.replace(/-/g, '')}`,
    classId: classId(cfg, d),
    state: 'ACTIVE',
    ticketNumber: d.bookingCode,
    reservationInfo: { confirmationCode: d.bookingCode },
    barcode: { type: 'QR_CODE', value: d.token, alternateText: d.bookingCode },
    validTimeInterval: {
      start: { date: berlinIso(d.date, d.startTime) },
      end: { date: berlinIso(d.date, d.endTime) },
    },
    textModulesData: [
      { id: 'persons', header: 'Personen', body: String(d.persons) },
      {
        id: 'included',
        header: 'Inklusive',
        body: `Lounge exklusiv für 2 Stunden, ${d.talerCount} Residenztaler, Tischservice der Tanzschule Fricke.`,
      },
    ],
  };
}

/** Legt die Klasse für das Zeitfenster an (409 = gibt es schon). */
export async function ensureEventClass(
  cfg: GoogleWalletConfig,
  d: GoogleTicketData,
): Promise<void> {
  const id = classId(cfg, d);
  if (knownClasses.has(id)) return;
  const res = await fetch(`${cfg.apiBase}/eventTicketClass`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken(cfg)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildEventClass(cfg, d)),
  });
  if (!res.ok && res.status !== 409)
    throw new Error(`Google Wallet Klasse ${res.status}: ${await res.text()}`);
  await res.body?.cancel();
  knownClasses.add(id);
}

/** „In Google Wallet speichern“-Link mit signiertem JWT. */
export async function googleSaveUrl(cfg: GoogleWalletConfig, d: GoogleTicketData): Promise<string> {
  await ensureEventClass(cfg, d);
  const jwt = await signJwt(
    {
      iss: cfg.clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [d.siteUrl.replace(/\/$/, '')],
      payload: { eventTicketObjects: [buildEventObject(cfg, d)] },
    },
    cfg.privateKeyPem,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
