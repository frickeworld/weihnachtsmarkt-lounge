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

interface DemoSpecial {
  title: string;
  act: string | null;
  description: string;
  totalCents: number;
  talerCount: number;
}

/** Sondertermine der Vorschau – wie in der Migration 20261013091000_christmas_specials. */
const PARTY: DemoSpecial = {
  title: 'Party-Abend',
  act: null,
  description:
    'An diesem Abend wird auf dem Weihnachtsmarkt gefeiert. Du erlebst die Party aus deiner eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.',
  totalCents: 18900,
  talerCount: 100,
};
const HEILIGABEND: DemoSpecial = {
  title: 'Heiligabend exklusiv',
  act: null,
  description:
    'Nur einmal im Jahr: drei Stunden Lounge am Heiligabend-Vormittag, exklusiv für dich und deine Gäste – mit 150 € Freiverzehr und Tischservice. Der schönste Start in den Heiligabend.',
  totalCents: 29900,
  talerCount: 150,
};
const FEIERTAG: DemoSpecial = {
  title: '2. Weihnachtsfeiertag',
  act: null,
  description:
    'Weihnachten in der Lounge ausklingen lassen: zwei Stunden für dich und deine Gäste, mit 100 € Freiverzehr und Tischservice.',
  totalCents: 19900,
  talerCount: 100,
};
const PARTY_DAYS = ['2026-12-22', '2026-12-23', '2026-12-29', '2026-12-30'];
const CLOSED_DAYS = ['2026-12-25', '2026-12-27', '2026-12-28'];
/** Einmalige Zeitfenster, die die Vorlagen des Tages ersetzen. */
const EXTRA_SLOTS: Record<IsoDate, { startTime: string; endTime: string; label: string }[]> = {
  '2026-12-24': [{ startTime: '10:00', endTime: '13:00', label: 'Vormittag' }],
  '2026-12-26': [
    { startTime: '13:00', endTime: '15:00', label: 'Mittag' },
    { startTime: '16:00', endTime: '18:00', label: 'Nachmittag' },
  ],
};

function demoSpecial(date: IsoDate): DemoSpecial | undefined {
  if (PARTY_DAYS.includes(date)) return PARTY;
  if (date === '2026-12-24') return HEILIGABEND;
  if (date === '2026-12-26') return FEIERTAG;
  return undefined;
}

export async function demoAvailability(from: IsoDate, to: IsoDate): Promise<SlotAvailability[]> {
  await wait(250);
  const s = PUBLIC_SETTINGS_FALLBACK;
  const today = todayInBerlin();
  const out: SlotAvailability[] = [];
  for (let d = from; parseIsoDate(d) <= parseIsoDate(to); d = addDays(d, 1)) {
    const tiers: {
      startTime: string;
      endTime: string;
      label: string | null;
      totalCents?: number;
      talerCount?: number;
    }[] = EXTRA_SLOTS[d] ?? s.priceList.filter((t) => t.weekday === isoWeekday(d));
    const day = parseIsoDate(d).getUTCDate();
    const special = demoSpecial(d);
    tiers.forEach(({ startTime, endTime, label, totalCents, talerCount }, i) => {
      let status: SlotStatus = 'free';
      if (d < s.seasonStart || d > s.seasonEnd) status = 'out_of_season';
      else if (d < today) status = 'past';
      else if (CLOSED_DAYS.includes(d)) status = 'closed';
      else if (!special && day % 6 === 4) status = 'taken';
      else if (!special && day % 5 === 2 && i === 1) status = 'taken';
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
      const d = demoSpecial(x.date)!;
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
