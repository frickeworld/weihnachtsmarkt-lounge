import { trackEvent, trackPageViewEvent } from './api';

/**
 * Cookieloses Tracking über Supabase: Ereignistyp, Gerätetyp, Seite und grobe Herkunft.
 * Keine Cookies, keine IDs, keine IP-Adressen. Fehler werden still ignoriert.
 */
function device(): 'mobile' | 'desktop' {
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

/** Bekannte Verweis-Domains, zusammengefasst (Rest: Domain ohne „www.“). */
const SOURCES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)weihnachtsmarkt-detmold\.de$/, 'weihnachtsmarkt-detmold.de'],
];

/**
 * Herkunft: utm_source aus dem Link (z. B. ?utm_source=plakat), sonst die Domain des Verweises.
 * Ohne Verweis (Lesezeichen, eingetippt, QR-Code ohne Parameter, viele Apps): „direkt“.
 */
export function trafficSource(search: string, referrer: string, ownHost: string): string {
  const utm = new URLSearchParams(search).get('utm_source');
  const clean = (v: string) =>
    v
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 40);
  if (utm && clean(utm)) return clean(utm);
  const host = hostOf(referrer);
  if (!host || host === ownHost.replace(/^www\./, '')) return 'direkt';
  for (const [re, name] of SOURCES) if (re.test(host)) return name;
  return clean(host) || 'direkt';
}

function hostOf(referrer: string): string {
  try {
    return referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

const sent = new Set<string>();

/** Einmal pro Seitenladen und Seite (StrictMode rendert Effekte doppelt). */
export function trackPageView(page: 'start' | 'gewinnspiel' = 'start'): void {
  if (sent.has(page)) return;
  sent.add(page);
  const source = trafficSource(window.location.search, document.referrer, window.location.hostname);
  void trackPageViewEvent(device(), page, source).catch(() => undefined);
}

/** Für alle „Lounge buchen“-Buttons (Header, Hero, Preis, mobile Buchungsleiste). */
export function trackBookClick(): void {
  void trackEvent('book_click', device()).catch(() => undefined);
}
