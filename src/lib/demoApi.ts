// Beispieldaten für den Vorschau-Modus. Wird nur bei VITE_DEMO=true eingebunden.
import type { SlotAvailability, SlotStatus } from './availability';
import { addDays, isoWeekday, parseIsoDate, todayInBerlin, type IsoDate } from './dates';
import { PUBLIC_SETTINGS_FALLBACK, type PublicSettings } from './settings';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function demoSettings(): Promise<PublicSettings> {
  await wait(150);
  return PUBLIC_SETTINGS_FALLBACK;
}

export async function demoAvailability(from: IsoDate, to: IsoDate): Promise<SlotAvailability[]> {
  await wait(250);
  const s = PUBLIC_SETTINGS_FALLBACK;
  const today = todayInBerlin();
  const out: SlotAvailability[] = [];
  for (let d = from; parseIsoDate(d) <= parseIsoDate(to); d = addDays(d, 1)) {
    const weekend = isoWeekday(d) >= 6;
    const times = weekend
      ? [
          ['17:30', '19:30'],
          ['19:30', '21:30'],
        ]
      : [
          ['17:00', '19:00'],
          ['19:00', '21:00'],
        ];
    const day = parseIsoDate(d).getUTCDate();
    times.forEach(([startTime, endTime], i) => {
      let status: SlotStatus = 'free';
      if (d < s.seasonStart || d > s.seasonEnd) status = 'out_of_season';
      else if (d < today) status = 'past';
      else if (day === 30) status = 'closed';
      else if (day % 6 === 4) status = 'taken';
      else if (day % 5 === 2 && i === 1) status = 'taken';
      out.push({ date: d, startTime: startTime!, endTime: endTime!, status });
    });
  }
  return out;
}

export const DEMO_TICKET_TOKEN = 'VorschauTicket000000000000000000';
