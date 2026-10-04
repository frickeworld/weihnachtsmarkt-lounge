// Apple Wallet: .pkpass = ZIP aus pass.json, Bildern, manifest.json (SHA-1) und PKCS#7-Signatur.
// Signiert mit dem Pass-Type-Zertifikat von MF Coaching und dem Apple-WWDR-Zwischenzertifikat.
import forge from 'node-forge';
import { zipSync } from 'fflate';
import { berlinIso } from './format.ts';
import type { AppleWalletConfig } from './walletConfig.ts';
import { LOUNGE_COORDINATES } from './walletConfig.ts';

export interface ApplePassData {
  token: string;
  bookingCode: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  dateLabel: string;
  persons: number;
  talerCount: number;
  location: string;
  contactEmail: string;
  siteUrl: string;
}

/** Pflicht: icon.png. Logos optional, aber empfohlen. */
export type PassImages = Partial<
  Record<
    'icon.png' | 'icon@2x.png' | 'icon@3x.png' | 'logo.png' | 'logo@2x.png' | 'logo@3x.png',
    Uint8Array
  >
>;

export function buildPassJson(
  cfg: Pick<AppleWalletConfig, 'passTypeId' | 'teamId'>,
  d: ApplePassData,
) {
  const start = berlinIso(d.date, d.startTime);
  const end = berlinIso(d.date, d.endTime);
  return {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: d.bookingCode,
    organizationName: 'Weihnachtsmarkt-Lounge der Händler',
    description: 'Ticket Weihnachtsmarkt-Lounge der Händler',
    logoText: 'Weihnachtsmarkt-Lounge',
    // Design: Dunkelbraun mit weißem Händler-Logo und Gold-Beschriftung
    backgroundColor: 'rgb(36, 34, 30)',
    foregroundColor: 'rgb(248, 243, 232)',
    labelColor: 'rgb(232, 214, 168)',
    relevantDate: start,
    relevantDates: [{ startDate: start, endDate: end }],
    expirationDate: end,
    sharingProhibited: false,
    locations: [
      { ...LOUNGE_COORDINATES, relevantText: 'Deine Lounge auf dem Weihnachtsmarkt wartet.' },
    ],
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: d.token,
        messageEncoding: 'iso-8859-1',
        altText: d.bookingCode,
      },
    ],
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: d.token,
      messageEncoding: 'iso-8859-1',
      altText: d.bookingCode,
    },
    eventTicket: {
      headerFields: [{ key: 'time', label: 'BEGINN', value: `${d.startTime} Uhr` }],
      primaryFields: [{ key: 'date', label: 'LOUNGE DER HÄNDLER', value: d.dateLabel }],
      secondaryFields: [
        { key: 'slot', label: 'ZEITFENSTER', value: `${d.startTime}–${d.endTime} Uhr` },
        { key: 'persons', label: 'PERSONEN', value: String(d.persons) },
      ],
      auxiliaryFields: [{ key: 'code', label: 'BUCHUNGSCODE', value: d.bookingCode }],
      backFields: [
        { key: 'where', label: 'Ort', value: d.location },
        {
          key: 'included',
          label: 'Inklusive',
          value: `Lounge exklusiv für 2 Stunden, ${d.talerCount} Residenztaler für Speisen und Getränke, Tischservice der Tanzschule Fricke.`,
        },
        {
          key: 'entry',
          label: 'Einlass',
          value: 'Zeig den QR-Code am Einlass. Das Ticket ist übertragbar.',
        },
        { key: 'contact', label: 'Fragen', value: d.contactEmail },
        { key: 'web', label: 'Website', value: d.siteUrl },
      ],
    },
  };
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Abgetrennte PKCS#7-Signatur (DER) über das Manifest. */
export function signManifest(cfg: AppleWalletConfig, manifest: Uint8Array): Uint8Array {
  const cert = forge.pki.certificateFromPem(cfg.certPem);
  const wwdr = forge.pki.certificateFromPem(cfg.wwdrPem);
  const key = cfg.keyPassword
    ? forge.pki.decryptRsaPrivateKey(cfg.keyPem, cfg.keyPassword)
    : forge.pki.privateKeyFromPem(cfg.keyPem);
  if (!key) throw new Error('Apple-Pass-Schlüssel konnte nicht gelesen werden (Passwort?)');
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(new TextDecoder('latin1').decode(manifest));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Uint8Array.from(der, (c: string) => c.charCodeAt(0));
}

export async function buildPkpass(
  cfg: AppleWalletConfig,
  d: ApplePassData,
  images: PassImages,
): Promise<Uint8Array> {
  if (!images['icon.png']) throw new Error('icon.png für den Wallet-Pass fehlt');
  const files: Record<string, Uint8Array> = {
    'pass.json': new TextEncoder().encode(JSON.stringify(buildPassJson(cfg, d))),
  };
  for (const [name, bytes] of Object.entries(images)) if (bytes) files[name] = bytes;
  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = await sha1Hex(bytes);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  files['manifest.json'] = manifestBytes;
  files['signature'] = signManifest(cfg, manifestBytes);
  return zipSync(files, { level: 6 });
}
