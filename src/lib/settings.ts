/**
 * Öffentliche Einstellungen aus get_public_settings().
 * PUBLIC_SETTINGS_FALLBACK ist nur der Startwert für den ersten Render, bis die Datenbank antwortet –
 * die verbindlichen Beträge liegen in der Tabelle settings und werden nur serverseitig verwendet.
 */
/** Preis eines Zeitfensters laut Vorlage (Endpreis inkl. Verarbeitungsgebühr). */
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
  /** Feste Gebühr (nur wenn kein Prozentsatz gesetzt ist) */
  feeCents: number;
  /** Verarbeitungsgebühr in Prozent auf den Lounge-Preis (z. B. 5), genau auf den Cent */
  feePercent: number | null;
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
  totalCents: Math.round(euros * 100),
  talerCount: taler,
  label,
});

/** Startwerte bis zur Antwort der Datenbank (Stand 04.11.2026: Lounge-Preis + genau 5 %). */
const FALLBACK_PRICE_LIST: PriceTier[] = [
  ...[1, 2, 3, 4].flatMap((d) => [
    tier(d, '14:30', '16:30', 103.95, 50, 'Nachmittag'),
    tier(d, '16:45', '18:45', 156.45, 75, 'Früher Abend'),
    tier(d, '19:00', '21:00', 156.45, 75, 'Später Abend'),
  ]),
  ...[5, 6].flatMap((d) => [
    tier(d, '15:30', '17:30', 156.45, 75, 'Nachmittag'),
    tier(d, '17:45', '19:45', 208.95, 100, 'Früher Abend'),
    tier(d, '20:00', '22:00', 208.95, 100, 'Später Abend'),
  ]),
  tier(7, '14:30', '16:30', 156.45, 75, 'Nachmittag'),
  tier(7, '16:45', '18:45', 156.45, 75, 'Früher Abend'),
  tier(7, '19:00', '21:00', 156.45, 75, 'Später Abend'),
];

export const PUBLIC_SETTINGS_FALLBACK: PublicSettings = {
  priceCents: 17500,
  feeCents: 350,
  feePercent: 5,
  talerCount: 100,
  maxPersons: 10,
  seasonStart: '2026-11-30',
  seasonEnd: '2026-12-30',
  contactEmail: 'info@studio-f.club',
  bookingCutoffMinutes: 60,
  priceList: FALLBACK_PRICE_LIST,
};

export function totalCents(s: Pick<PublicSettings, 'priceCents' | 'feeCents'>): number {
  return s.priceCents + s.feeCents;
}

/**
 * Gebühr, die in einem Endpreis steckt – gleiche Regel wie slot_fee() in der Datenbank:
 * Lounge-Preis = Endpreis ÷ (1 + Prozent), auf volle Euro gerundet; Gebühr = Rest.
 * Nur zur Anzeige; abgerechnet wird ausschließlich auf dem Server.
 */
export function feeFor(total: number, s: Pick<PublicSettings, 'feeCents' | 'feePercent'>): number {
  if (s.feePercent == null) return s.feeCents;
  return total - Math.round(total / (1 + s.feePercent / 100) / 100) * 100;
}

/** „5 %“ bzw. „3,50 €“ für Texte wie „inkl. … Verarbeitungsgebühr“. */
export function feeLabel(s: Pick<PublicSettings, 'feeCents' | 'feePercent'>): string {
  if (s.feePercent == null)
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
      s.feeCents / 100,
    );
  return `${s.feePercent.toLocaleString('de-DE')} %`;
}

/**
 * Lounge-Preis ohne Verarbeitungsgebühr (z. B. 104 € → 99 €). Beworben wird dieser Preis
 * (Entscheidung Louis, 04.11.2026); die Gebühr kommt im Buchungsformular und im Checkout dazu.
 */
export function loungeCents(
  total: number,
  s: Pick<PublicSettings, 'feeCents' | 'feePercent'>,
): number {
  return total - feeFor(total, s);
}

/** Günstigster beworbener Lounge-Preis ohne Gebühr („ab 99 €“). */
export function minLoungeCents(
  s: Pick<PublicSettings, 'priceList' | 'priceCents' | 'feeCents' | 'feePercent'>,
): number {
  return loungeCents(minPriceCents(s), s);
}

/** „zzgl. 5 % Verarbeitungsgebühr“ */
export function feeNote(s: Pick<PublicSettings, 'feeCents' | 'feePercent'>): string {
  return `zzgl. ${feeLabel(s)} Verarbeitungsgebühr`;
}

/** Günstigster Endpreis inkl. Gebühr (103,95 €). */
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
