import type { QueueItem, TodayList } from './types';

// sessionStorage: gilt nur für diesen Tab und verschwindet beim Schließen (keine Daten auf Dauer).
const KEYS = {
  session: 'scanner.session',
  today: 'scanner.today',
  queue: 'scanner.queue',
} as const;

function read<T>(key: string): T | null {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Speicher voll oder gesperrt – der Scanner funktioniert online trotzdem */
  }
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
  today: () => read<TodayList>(KEYS.today),
  setToday: (t: TodayList | null) => write(KEYS.today, t),
  queue: () => read<QueueItem[]>(KEYS.queue) ?? [],
  setQueue: (q: QueueItem[]) => write(KEYS.queue, q.length ? q : null),
  clear: () => Object.values(KEYS).forEach((k) => write(k, null)),
};
