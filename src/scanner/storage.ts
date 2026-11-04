import type { QueueItem, TodayList } from './types';

// localStorage statt sessionStorage (seit 04.11.2026): Schließt das Handy den Tab – iPhones tun das
// gern –, bleiben Anmeldung, Tagesliste und noch nicht übertragene Check-ins erhalten. Die
// Tagesliste gilt nur für ihren Tag und wird danach verworfen; die Anmeldung läuft nach 12 Stunden
// ab. Nicht übertragene Check-ins bleiben, bis sie übertragen sind (auch über eine Abmeldung hinweg).
const KEYS = {
  session: 'scanner.session',
  today: 'scanner.today',
  queue: 'scanner.queue',
} as const;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string): T | null {
  try {
    const s = storage();
    // Übernahme aus der alten Ablage im Tab-Speicher
    const v = s?.getItem(key) ?? sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    const s = storage();
    if (value === null) s?.removeItem(key);
    else s?.setItem(key, JSON.stringify(value));
    sessionStorage.removeItem(key);
  } catch {
    /* Speicher voll oder gesperrt – der Scanner funktioniert online trotzdem */
  }
}

/** Heutiges Datum in Berlin (YYYY-MM-DD). */
export function berlinToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}

export interface ScannerSession {
  token: string;
  expiresAt: string;
}

export const store = {
  session: () => {
    const s = read<ScannerSession>(KEYS.session);
    return s && Date.parse(s.expiresAt) > Date.now() ? s : null;
  },
  setSession: (s: ScannerSession | null) => write(KEYS.session, s),
  /** Nur die Liste von heute; eine Liste von gestern wird nicht mehr benutzt. */
  today: () => {
    const t = read<TodayList>(KEYS.today);
    return t && t.date === berlinToday() ? t : null;
  },
  setToday: (t: TodayList | null) => write(KEYS.today, t),
  queue: () => read<QueueItem[]>(KEYS.queue) ?? [],
  setQueue: (q: QueueItem[]) => write(KEYS.queue, q.length ? q : null),
  /** Abmelden: Anmeldung und Tagesliste löschen; nicht übertragene Check-ins bleiben erhalten. */
  clear: () => {
    write(KEYS.session, null);
    write(KEYS.today, null);
  },
};
