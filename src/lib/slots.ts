import { addDays, isoWeekday, parseIsoDate, type IsoDate } from './dates';
import type { SlotAvailability, SlotStatus } from './availability';

export interface SlotTemplate {
  weekday: number; // 1 = Mo … 7 = So
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

/** Standard-Zeitfenster. Ab Phase 2 kommen sie aus slot_templates. */
export const DEFAULT_SLOT_TEMPLATES: SlotTemplate[] = [1, 2, 3, 4, 5]
  .flatMap((weekday) => [
    { weekday, startTime: '17:00', endTime: '19:00' },
    { weekday, startTime: '19:00', endTime: '21:00' },
  ])
  .concat(
    [6, 7].flatMap((weekday) => [
      { weekday, startTime: '17:30', endTime: '19:30' },
      { weekday, startTime: '19:30', endTime: '21:30' },
    ]),
  );

export function slotsForDate(date: IsoDate, templates = DEFAULT_SLOT_TEMPLATES): SlotTemplate[] {
  const wd = isoWeekday(date);
  return templates
    .filter((t) => t.weekday === wd)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Beispieldaten für Phase 1 (ohne Backend). Deterministisch, damit Screenshots und Tests stabil sind.
 * Wird in Phase 2 durch get_availability() ersetzt.
 */
export function sampleAvailability(
  from: IsoDate,
  to: IsoDate,
  season: { start: IsoDate; end: IsoDate },
  today: IsoDate,
): SlotAvailability[] {
  const out: SlotAvailability[] = [];
  for (let d = from; parseIsoDate(d) <= parseIsoDate(to); d = addDays(d, 1)) {
    const day = parseIsoDate(d).getUTCDate();
    slotsForDate(d).forEach((t, i) => {
      let status: SlotStatus = 'free';
      if (d < season.start || d > season.end) status = 'out_of_season';
      else if (d < today) status = 'past';
      else if (day === 24 || day === 1) status = 'closed';
      else if (day % 7 === 5) status = 'taken';
      else if (day % 5 === 2 && i === 1) status = 'taken';
      out.push({ date: d, startTime: t.startTime, endTime: t.endTime, status });
    });
  }
  return out;
}
