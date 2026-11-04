// Beispieldaten für den Vorschau-Modus. Wird nur bei VITE_DEMO=true eingebunden.
import type { SlotAvailability, SlotStatus } from './availability';
import { addDays, isoWeekday, parseIsoDate, todayInBerlin, type IsoDate } from './dates';
import type { ProgramItem, SpecialEvent } from './api';
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
const party = (title: string, act: string, description: string): DemoSpecial => ({
  title,
  act,
  description,
  totalCents: 19845,
  talerCount: 100,
});
/** Programm wie Migration 20261104150000_party_program. */
const PARTIES: Record<IsoDate, DemoSpecial> = {
  '2026-12-22': party(
    'Jingle Beatz',
    'Disco Classics open air · powered by STUDIO/F',
    'STUDIO/F holt den Club auf den Weihnachtsmarkt: die größten Disco-Hits zum Mitfeiern und Mittanzen auf Frickes Tanzfläche (17:30–21:45 Uhr, Eintritt frei). Du feierst aus deiner eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.',
  ),
  '2026-12-23': party(
    'Coming Home for Christmas',
    'All Time Classics – die größten Hits aller Zeiten',
    'Die Party vor Heiligabend auf Frickes Tanzfläche (18:00–21:45 Uhr): All Time Classics zum Mitsingen und Tanzen. Du feierst aus deiner eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.',
  ),
  '2026-12-29': party(
    '80er- & 90er-Party mit DJ',
    'präsentiert von der Tanzschule Fricke',
    'Zum Aufwärmen um 17:00 Uhr ein kostenloser Discofox-Workshop der Tanzschule Fricke für Einsteiger und Fortgeschrittene, danach die Hits der 80er und 90er auf Frickes Tanzfläche (17:30–21:45 Uhr). Du feierst aus deiner eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.',
  ),
  '2026-12-30': party(
    'Discofox zum Jahresausklang',
    'Discofox-Workshop der Tanzschule Fricke',
    'Um 17:00 Uhr zeigt dir die Tanzschule Fricke auf Frickes Tanzfläche die Discofox-Schritte – kostenlos, für Einsteiger und Fortgeschrittene. Danach genießt du den letzten Marktabend des Jahres in deiner eigenen überdachten Lounge – mit 100 € Freiverzehr und Tischservice.',
  ),
};
const HEILIGABEND: DemoSpecial = {
  title: 'Heiligabend exklusiv',
  act: null,
  description:
    'Nur einmal im Jahr: drei Stunden Lounge am Heiligabend-Vormittag, exklusiv für dich und deine Gäste – mit 150 € Freiverzehr und Tischservice. Der schönste Start in den Heiligabend.',
  totalCents: 31395,
  talerCount: 150,
};
/** Party nur abends; der Nachmittag bleibt ein normales Zeitfenster. */
const PARTY_TIMES = ['16:45', '19:00'];
const CLOSED_DAYS = ['2026-12-25', '2026-12-26'];
/** Einmalige Zeitfenster, die die Vorlagen des Tages ersetzen. */
const EXTRA_SLOTS: Record<IsoDate, { startTime: string; endTime: string; label: string }[]> = {
  '2026-12-24': [{ startTime: '10:00', endTime: '13:00', label: 'Vormittag' }],
};

function demoSpecial(date: IsoDate, startTime: string): DemoSpecial | undefined {
  if (PARTIES[date] && PARTY_TIMES.includes(startTime)) return PARTIES[date];
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

/** Programm der Vorschau – wie Migration 20261104190000_market_program. */
const DEMO_PROGRAM: [IsoDate, string, string | null, string, string | null, string][] = [
  [
    '2026-12-04',
    '18:30',
    '19:30',
    'Tanzworkshop Langsamer Walzer',
    'Kostenloser Workshop von Anfänger bis Fortgeschrittene, präsentiert von der Tanzschule Fricke',
    'Frickes Tanzfläche',
  ],
  [
    '2026-12-04',
    '19:30',
    '20:30',
    'Paartanzabend – Ballroom Night',
    'Von klassisch bis Cha-Cha-Cha, präsentiert von der Tanzschule Fricke',
    'Frickes Tanzfläche',
  ],
  [
    '2026-12-04',
    '20:30',
    '21:45',
    'Discofox All Night Long',
    'Präsentiert von der Tanzschule Fricke',
    'Frickes Tanzfläche',
  ],
  [
    '2026-12-05',
    '17:00',
    null,
    'My Christmas DAY DÄNZiNG',
    'DJ ElectroArt Jens Naumann, präsentiert von der Cosmo Lounge',
    'Winterbühne',
  ],
  [
    '2026-12-05',
    '19:00',
    null,
    'Indian Motorcycle Band',
    'Handgemachter Rhythm & Blues, präsentiert von der Cosmo Lounge',
    'Winterbühne',
  ],
  [
    '2026-12-11',
    '19:00',
    null,
    'Phil Solo',
    'Singer-Songwriter, präsentiert von der Werbegemeinschaft Detmold e. V.',
    'Winterbühne',
  ],
  ['2026-12-12', '17:00', null, 'Tanzsport Fröse', null, 'Winterbühne'],
  [
    '2026-12-12',
    '19:00',
    null,
    'Marzena & Manuel',
    'Acoustic Pop, präsentiert von der Cosmo Lounge',
    'Winterbühne',
  ],
  ['2026-12-18', '17:00', null, 'Musiktheaterstudio Inspiration', null, 'Winterbühne'],
  [
    '2026-12-18',
    '19:00',
    null,
    '4 Souls',
    'Die besten Cover-Songs aus Soul, Pop, Rock & Schlager, präsentiert von der Cosmo Lounge',
    'Winterbühne',
  ],
  [
    '2026-12-19',
    '19:00',
    null,
    '4 Souls',
    'Die besten Cover-Songs aus Soul, Pop, Rock & Schlager, präsentiert von der Cosmo Lounge',
    'Winterbühne',
  ],
];

export async function demoMarketProgram(): Promise<ProgramItem[]> {
  const today = todayInBerlin();
  return DEMO_PROGRAM.filter(([d]) => d >= today).map(
    ([date, startTime, endTime, title, description, location]) => ({
      date,
      startTime,
      endTime,
      title,
      description,
      location,
    }),
  );
}
