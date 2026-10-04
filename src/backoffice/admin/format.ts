import { parseIsoDate } from '@/lib/dates';

const shortDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTime = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

/** „Sa., 05.12.2026“ – Kalendertag ohne Zeitzonen-Verschiebung. */
export function formatDay(d: string): string {
  return shortDate.format(parseIsoDate(d));
}

/** Zeitpunkt in Berliner Zeit: „05.12.2026, 17:42“. */
export function formatDateTime(ts: string | null | undefined): string {
  return ts ? dateTime.format(new Date(ts)) : '–';
}

export function hhmm(t: string): string {
  return t.slice(0, 5);
}

/** „12,5 %“ – Quote mit einer Nachkommastelle, „–“ wenn der Nenner 0 ist. */
export function percent(part: number, whole: number): string {
  if (!whole) return '–';
  return `${(Math.round((part / whole) * 1000) / 10).toLocaleString('de-DE')} %`;
}

/** Euro-Eingabe („175“, „175,50“, „1.234,5“) in Cent. null bei ungültiger Eingabe. */
export function parseEuroToCents(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '');
  if (!/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(s)) return null;
  const [euros, cents = ''] = s.replace(/\./g, '').split(',');
  return Number(euros) * 100 + Number(cents.padEnd(2, '0'));
}

export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Letzter vergangener 31. März (Stichtag laut Löschkonzept). */
export function lastCutoff(today: string): string {
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-03-31`;
  return today >= thisYear ? thisYear : `${y - 1}-03-31`;
}
