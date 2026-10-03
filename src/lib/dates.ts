/**
 * Datumslogik ohne Zeitzonen-Fallen: Kalendertage werden als 'YYYY-MM-DD' geführt und
 * intern als UTC-Mitternacht gerechnet. Uhrzeiten von Zeitfenstern gelten immer in Europe/Berlin.
 */
export type IsoDate = string;

export function parseIsoDate(d: IsoDate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!));
}

export function toIsoDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const x = parseIsoDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toIsoDate(x);
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(d: IsoDate): number {
  const w = parseIsoDate(d).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Heutiges Datum in Europe/Berlin. */
export function todayInBerlin(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}

/** Wochen eines Monats (Montag zuerst), Tage außerhalb des Monats sind null. */
export function monthGrid(year: number, month: number): (IsoDate | null)[][] {
  const first = toIsoDate(new Date(Date.UTC(year, month - 1, 1)));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = isoWeekday(first) - 1;
  const cells: (IsoDate | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < daysInMonth; i++) cells.push(addDays(first, i));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const longDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthTitle = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatLongDate(d: IsoDate): string {
  return longDate.format(parseIsoDate(d));
}

export function formatMonth(year: number, month: number): string {
  return monthTitle.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** '17:00:00' oder '17:00' → '17:00' */
export function formatTime(t: string): string {
  return t.slice(0, 5);
}
