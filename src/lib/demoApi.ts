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

/**
 * Sondertermine der Vorschau – wie live (Migrationen 20261013091000_christmas_specials und
 * 20261104120000_fee_percent: Preise inkl. 5 % Gebühr).
 */
const PARTY: DemoSpecial = {
  title: 'Party-Abend',
  act: null,
  description:
    'An diesem Abend wird auf dem Weihnachtsmarkt gefeiert. Du erlebst die Party aus deiner eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.',
  totalCents: 19800,
  talerCount: 100,
};
const HEILIGABEND: DemoSpecial = {
  title: 'Heiligabend exklusiv',
  act: null,
  description:
    'Nur einmal im Jahr: drei Stunden Lounge am Heiligabend-Vormittag, exklusiv für dich und deine Gäste – mit 150 € Freiverzehr und Tischservice. Der schönste Start in den Heiligabend.',
  totalCents: 31400,
  talerCount: 150,
};
const PARTY_DAYS = ['2026-12-22', '2026-12-23', '2026-12-29', '2026-12-30'];
/** Party nur abends; der Nachmittag bleibt ein normales Zeitfenster. */
const PARTY_TIMES = ['16:45', '19:00'];
const CLOSED_DAYS = ['2026-12-25', '2026-12-26'];
/** Einmalige Zeitfenster, die die Vorlagen des Tages ersetzen. */
const EXTRA_SLOTS: Record<IsoDate, { startTime: string; endTime: string; label: string }[]> = {
  '2026-12-24': [{ startTime: '10:00', endTime: '13:00', label: 'Vormittag' }],
};

function demoSpecial(date: IsoDate, startTime: string): DemoSpecial | undefined {
  if (PARTY_DAYS.includes(date) && PARTY_TIMES.includes(startTime)) return PARTY;
  if (date === '2026-12-24') return HEILIGABEND;
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
    tiers.forEach(({ startTime, endTime, label, totalCents, talerCount }) => {
      const special = demoSpecial(d, startTime);
      let status: SlotStatus = 'free';
      if (d < s.seasonStart || d > s.seasonEnd) status = 'out_of_season';
      else if (d < today) status = 'past';
      else if (CLOSED_DAYS.includes(d)) status = 'closed';
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
      const d = demoSpecial(x.date, x.startTime)!;
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
