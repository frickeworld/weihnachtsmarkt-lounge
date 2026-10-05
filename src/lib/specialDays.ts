import { addDays, isoWeekday, type IsoDate } from './dates';

/** Besondere Tage der Saison – Silvester und Heiligabend entfallen (Markt ist dann vorbei). */
export type SpecialDay =
  | { kind: 'opening'; title: string; text: string }
  | { kind: 'nikolaus'; title: string; text: string; advent: number }
  | { kind: 'advent'; title: string; text: string; advent: number }
  | { kind: 'last'; title: string; text: string }
  | { kind: 'adventWeek'; advent: number };

/** Datum des 4. Advents: letzter Sonntag vor dem 25. Dezember. */
export function fourthAdvent(year: number): IsoDate {
  let d: IsoDate = `${year}-12-24`;
  while (isoWeekday(d) !== 7) d = addDays(d, -1);
  return d;
}

/** Nummer des Advents (1–4), in dessen Woche `date` liegt, sonst 0. */
export function adventOf(date: IsoDate): number {
  const year = Number(date.slice(0, 4));
  const fourth = fourthAdvent(year);
  for (let n = 4; n >= 1; n--) {
    const sunday = addDays(fourth, -(4 - n) * 7);
    if (date >= sunday && date < addDays(sunday, 7) && date <= `${year}-12-24`) return n;
  }
  return 0;
}

export function specialDay(
  date: IsoDate,
  seasonStart: IsoDate,
  seasonEnd: IsoDate,
): SpecialDay | null {
  if (date < seasonStart || date > seasonEnd) return null;
  const advent = adventOf(date);
  const isAdventSunday = advent > 0 && isoWeekday(date) === 7;
  if (date === seasonStart)
    return {
      kind: 'opening',
      title: 'Heute öffnet der Weihnachtsmarkt',
      text: 'Sei am ersten Abend dabei – die Lounge ist geheizt und der Glühwein warm.',
    };
  if (date.slice(5) === '12-06')
    return {
      kind: 'nikolaus',
      title: isAdventSunday ? `Frohen Nikolaus und schönen ${advent}. Advent` : 'Frohen Nikolaus',
      text: 'Heute stellen die Händler goldene Sterne in den Schnee.',
      advent,
    };
  if (isAdventSunday)
    return {
      kind: 'advent',
      title: `Schönen ${advent}. Advent`,
      text: advent === 4 ? 'Alle vier Kerzen brennen.' : `Heute brennt die ${advent}. Kerze.`,
      advent,
    };
  if (date === seasonEnd)
    return {
      kind: 'last',
      title: 'Heute ist der letzte Markttag',
      text: 'Ein letzter Abend in der Lounge, bevor der Weihnachtsmarkt schließt.',
    };
  return advent > 0 ? { kind: 'adventWeek', advent } : null;
}

/** Kurzer Hinweis für ein Ticket („Dein Termin fällt auf den 2. Advent“). */
export function ticketDayNote(
  date: IsoDate,
  seasonStart: IsoDate,
  seasonEnd: IsoDate,
): string | null {
  const d = specialDay(date, seasonStart, seasonEnd);
  if (!d || d.kind === 'adventWeek') return null;
  switch (d.kind) {
    case 'opening':
      return 'Dein Termin ist am Eröffnungstag des Weihnachtsmarkts.';
    case 'nikolaus':
      return 'Dein Termin fällt auf Nikolaus.';
    case 'advent':
      return `Dein Termin fällt auf den ${d.advent}. Advent.`;
    case 'last':
      return 'Dein Termin ist am letzten Markttag.';
  }
}
