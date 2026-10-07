/**
 * Öffentliche Einstellungen aus get_public_settings().
 * PUBLIC_SETTINGS_FALLBACK ist nur der Startwert für den ersten Render, bis die Datenbank antwortet –
 * die verbindlichen Beträge liegen in der Tabelle settings und werden nur serverseitig verwendet.
 */
/** Preis eines Zeitfensters laut Vorlage (Endpreis inkl. Vorverkaufsgebühr). */
export interface PriceTier {
  weekday: number; // 1 = Montag … 7 = Sonntag
  startTime: string; // HH:MM
  endTime: string;
  totalCents: number;
  talerCount: number;
  label: string | null; // „Nachmittag“ / „Abend“
}

export interface PublicSettings {
  /** Standardpreis (nur noch Rückfall für Zeitfenster ohne eigenen Preis) */
  priceCents: number;
  feeCents: number;
  talerCount: number;
  maxPersons: number;
  seasonStart: string; // YYYY-MM-DD
  seasonEnd: string; // YYYY-MM-DD
  contactEmail: string;
  bookingCutoffMinutes: number;
  /** Preisstaffel je Wochentag und Zeitfenster (aus get_price_list) */
  priceList: PriceTier[];
}

const tier = (
  weekday: number,
  startTime: string,
  endTime: string,
  euros: number,
  taler: number,
  label: string,
): PriceTier => ({
  weekday,
  startTime,
  endTime,
  totalCents: euros * 100,
  talerCount: taler,
  label,
});

/** Startwerte bis zur Antwort der Datenbank (Preisstaffel Stand 07.10.2026). */
const FALLBACK_PRICE_LIST: PriceTier[] = [
  ...[1, 2, 3, 4].flatMap((d) => [
    tier(d, '16:45', '18:45', 149, 75, 'Früher Abend'),
    tier(d, '19:00', '21:00', 149, 75, 'Später Abend'),
  ]),
  ...[5, 6].flatMap((d) => [
    tier(d, '15:30', '17:30', 149, 75, 'Nachmittag'),
    tier(d, '17:45', '19:45', 199, 100, 'Früher Abend'),
    tier(d, '20:00', '22:00', 199, 100, 'Später Abend'),
  ]),
  tier(7, '14:30', '16:30', 149, 75, 'Nachmittag'),
  tier(7, '16:45', '18:45', 149, 75, 'Früher Abend'),
  tier(7, '19:00', '21:00', 149, 75, 'Später Abend'),
];

export const PUBLIC_SETTINGS_FALLBACK: PublicSettings = {
  priceCents: 17500,
  feeCents: 350,
  talerCount: 100,
  maxPersons: 10,
  seasonStart: '2026-11-26',
  seasonEnd: '2026-12-23',
  contactEmail: 'info@studio-f.club',
  bookingCutoffMinutes: 60,
  priceList: FALLBACK_PRICE_LIST,
};

export function totalCents(s: Pick<PublicSettings, 'priceCents' | 'feeCents'>): number {
  return s.priceCents + s.feeCents;
}

/** Günstigster Endpreis („ab 149 €“). */
export function minPriceCents(
  s: Pick<PublicSettings, 'priceList' | 'priceCents' | 'feeCents'>,
): number {
  return s.priceList.length ? Math.min(...s.priceList.map((t) => t.totalCents)) : totalCents(s);
}

/** Höchster Freiverzehr („bis zu 100 €“). */
export function maxTalerCount(s: Pick<PublicSettings, 'priceList' | 'talerCount'>): number {
  return s.priceList.length ? Math.max(...s.priceList.map((t) => t.talerCount)) : s.talerCount;
}

/** Alle vorkommenden Freiverzehr-Stufen, aufsteigend (z. B. 50, 75, 100). */
export function talerLevels(s: Pick<PublicSettings, 'priceList' | 'talerCount'>): number[] {
  const set = new Set(s.priceList.map((t) => t.talerCount));
  return set.size ? [...set].sort((a, b) => a - b) : [s.talerCount];
}

const DAY_NAMES = [
  '',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

/** „Montag bis Donnerstag“, „Freitag und Samstag“, „Sonntag“, „Montag, Mittwoch und Freitag“. */
export function weekdayLabel(days: number[]): string {
  const d = [...days].sort((a, b) => a - b);
  if (d.length === 1) return DAY_NAMES[d[0]!]!;
  const consecutive = d.every((x, i) => i === 0 || x === d[i - 1]! + 1);
  if (consecutive && d.length > 2) return `${DAY_NAMES[d[0]!]} bis ${DAY_NAMES[d.at(-1)!]}`;
  return `${d
    .slice(0, -1)
    .map((x) => DAY_NAMES[x])
    .join(', ')} und ${DAY_NAMES[d.at(-1)!]}`;
}

export interface PriceGroup {
  days: string;
  rows: { label: string; times: string[]; totalCents: number; talerCount: number }[];
}

/**
 * Preisübersicht für die Website: Wochentage mit gleicher Staffel zusammenfassen,
 * gleiche Preise innerhalb eines Tages in eine Zeile (z. B. „16:45 und 19:00 Uhr“).
 */
export function priceGroups(list: PriceTier[]): PriceGroup[] {
  const byDay = new Map<number, PriceTier[]>();
  for (const t of list) byDay.set(t.weekday, [...(byDay.get(t.weekday) ?? []), t]);
  const signature = (tiers: PriceTier[]) =>
    tiers
      .map((t) => `${t.startTime}-${t.endTime}-${t.totalCents}-${t.talerCount}-${t.label ?? ''}`)
      .sort()
      .join('|');
  const groups = new Map<string, { days: number[]; tiers: PriceTier[] }>();
  for (const [day, tiers] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const key = signature(tiers);
    const g = groups.get(key) ?? { days: [], tiers };
    g.days.push(day);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => {
    const rows: PriceGroup['rows'] = [];
    for (const t of [...g.tiers].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const label = t.label ?? 'Lounge';
      const row = rows.find(
        (r) => r.label === label && r.totalCents === t.totalCents && r.talerCount === t.talerCount,
      );
      if (row) row.times.push(`${t.startTime}–${t.endTime}`);
      else
        rows.push({
          label,
          times: [`${t.startTime}–${t.endTime}`],
          totalCents: t.totalCents,
          talerCount: t.talerCount,
        });
    }
    return { days: weekdayLabel(g.days), rows };
  });
}
