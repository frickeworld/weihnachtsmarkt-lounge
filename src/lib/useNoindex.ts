import { useEffect } from 'react';

/** Setzt noindex für interne Seiten (Erfolgsseite, Ticket, Admin …), auch im Live-Build. */
export function useNoindex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}
