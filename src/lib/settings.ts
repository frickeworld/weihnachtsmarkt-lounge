/**
 * Öffentliche Einstellungen. Ab Phase 2 kommen sie aus der Funktion get_public_settings().
 * PUBLIC_SETTINGS_FALLBACK ist nur der Startwert für den ersten Render, bis die Datenbank antwortet –
 * die verbindlichen Beträge liegen in der Tabelle settings und werden nur serverseitig verwendet.
 */
export interface PublicSettings {
  priceCents: number;
  feeCents: number;
  talerCount: number;
  maxPersons: number;
  seasonStart: string; // YYYY-MM-DD
  seasonEnd: string; // YYYY-MM-DD
  contactEmail: string;
  bookingCutoffMinutes: number;
}

export const PUBLIC_SETTINGS_FALLBACK: PublicSettings = {
  priceCents: 17500,
  feeCents: 350,
  talerCount: 100,
  maxPersons: 10,
  seasonStart: '2026-11-26',
  seasonEnd: '2026-12-23',
  contactEmail: 'info@studio-f.club',
  bookingCutoffMinutes: 60,
};

export function totalCents(s: Pick<PublicSettings, 'priceCents' | 'feeCents'>): number {
  return s.priceCents + s.feeCents;
}
