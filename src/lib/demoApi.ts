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
    const tiers = s.priceList.filter((t) => t.weekday === isoWeekday(d));
    const day = parseIsoDate(d).getUTCDate();
    tiers.forEach(({ startTime, endTime, totalCents, talerCount, label }, i) => {
      let status: SlotStatus = 'free';
      if (d < s.seasonStart || d > s.seasonEnd) status = 'out_of_season';
      else if (d < today) status = 'past';
      else if (day === 30) status = 'closed';
      else if (day % 6 === 4) status = 'taken';
      else if (day % 5 === 2 && i === 1) status = 'taken';
      // Beispiel für einen Sondertermin in der Vorschau
      const special = day === 12 && i === 2;
      out.push({
        date: d,
        startTime,
        endTime,
        status,
        totalCents: special ? 24900 : totalCents,
        talerCount: special ? 125 : talerCount,
        specialTitle: special ? 'Party-Abend' : null,
        label,
      });
    });
  }
  return out;
}

export const DEMO_TICKET_TOKEN = 'VorschauTicket000000000000000000';
