import { trackEvent } from './api';

/**
 * Cookieloses Tracking über track_event() in Supabase: nur Ereignistyp und Gerätetyp,
 * keine Cookies, keine IDs, keine IP-Adressen. Fehler werden still ignoriert.
 */
function device(): 'mobile' | 'desktop' {
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

let pageViewSent = false;

export function trackPageView(): void {
  if (pageViewSent) return; // StrictMode rendert Effekte doppelt
  pageViewSent = true;
  void trackEvent('page_view', device()).catch(() => undefined);
}

/** Für alle „Lounge buchen“-Buttons (Header, Hero, Preis, mobile Buchungsleiste). */
export function trackBookClick(): void {
  void trackEvent('book_click', device()).catch(() => undefined);
}
