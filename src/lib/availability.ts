import type { IsoDate } from './dates';

/** Status eines Zeitfensters – identisch zu get_availability() in der Datenbank. */
export type SlotStatus = 'free' | 'taken' | 'blocked' | 'closed' | 'past' | 'out_of_season';

export interface SlotAvailability {
  date: IsoDate;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: SlotStatus;
  /** Endpreis inkl. Vorverkaufsgebühr (Preisstaffel / Sondertermin) */
  totalCents?: number;
  talerCount?: number;
  /** z. B. „Party-Abend“ bei Sonderveranstaltungen */
  specialTitle?: string | null;
  label?: string | null;
}

/** Tagesstatus für den Kalender. */
export type DayStatus = 'free' | 'last' | 'booked' | 'closed' | 'unavailable';

export function dayStatus(slots: SlotAvailability[]): DayStatus {
  if (slots.length === 0) return 'unavailable';
  if (slots.every((s) => s.status === 'out_of_season' || s.status === 'past')) return 'unavailable';
  if (slots.every((s) => s.status === 'closed')) return 'closed';
  const free = slots.filter((s) => s.status === 'free').length;
  if (free === 0) return 'booked';
  // „nur noch 1“ wörtlich nehmen: Bei drei Zeitfenstern ist ein Tag mit zwei freien noch „frei“.
  if (free === 1 && slots.length > 1) return 'last';
  return 'free';
}

export function groupByDate(slots: SlotAvailability[]): Map<IsoDate, SlotAvailability[]> {
  const map = new Map<IsoDate, SlotAvailability[]>();
  for (const s of slots) {
    const list = map.get(s.date) ?? [];
    list.push(s);
    map.set(s.date, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return map;
}
