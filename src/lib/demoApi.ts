// Beispieldaten für den Vorschau-Modus. Wird nur bei VITE_DEMO=true eingebunden.
import type { SlotAvailability, SlotStatus } from './availability';
import { addDays, isoWeekday, parseIsoDate, todayInBerlin, type IsoDate } from './dates';
import type { SpecialEvent } from './api';
import { PUBLIC_SETTINGS_FALLBACK, type PublicSettings } from './settings';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function demoSettings(): Promise<PublicSettings> {
  await wait(150);
  return PUBLIC_SETTINGS_FALLBACK;
}

/** Beispiel-Sonderveranstaltungen der Vorschau (Tag im Monat, Index des Zeitfensters). */
const DEMO_SPECIALS = [
  {
    day: 12,
    index: -1,
    title: 'Party-Abend',
    act: 'DJ [NAME]',
    description: '[PLATZHALTER: Text zur Party, z. B. Musik, Dresscode, Besonderheiten]',
    totalCents: 24900,
    talerCount: 125,
  },
  {
    day: 22,
    index: -1,
    title: 'Live-Abend',
    act: 'Live: [KÜNSTLER]',
    description: '[PLATZHALTER: Text zum Auftritt]',
    totalCents: 22900,
    talerCount: 110,
  },
];

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
      // Beispiele für Sondertermine in der Vorschau
      // index -1 = letztes Zeitfenster des Tages (Mo–Do gibt es nur zwei)
      const special = DEMO_SPECIALS.find(
        (x) => x.day === day && (x.index === -1 ? i === tiers.length - 1 : x.index === i),
      );
      out.push({
        date: d,
        startTime,
        endTime,
        status,
        totalCents: special?.totalCents ?? totalCents,
        talerCount: special?.talerCount ?? talerCount,
        specialTitle: special?.title ?? null,
        label,
      });
    });
  }
  return out;
}

export const DEMO_TICKET_TOKEN = 'VorschauTicket000000000000000000';

export async function demoSpecialEvents(): Promise<SpecialEvent[]> {
  const s = PUBLIC_SETTINGS_FALLBACK;
  const slots = await demoAvailability(s.seasonStart, s.seasonEnd);
  return slots
    .filter((x) => x.specialTitle && (x.status === 'free' || x.status === 'taken'))
    .map((x) => {
      const d = DEMO_SPECIALS.find((sp) => sp.title === x.specialTitle)!;
      return {
        date: x.date,
        startTime: x.startTime,
        endTime: x.endTime,
        title: d.title,
        act: d.act,
        description: d.description,
        totalCents: d.totalCents,
        talerCount: d.talerCount,
        status: x.status as 'free' | 'taken',
      };
    });
}
