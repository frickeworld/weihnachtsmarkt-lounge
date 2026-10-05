import { berlinIso } from '../../supabase/functions/_shared/format';

export type CountdownState =
  | { phase: 'before'; days: number; hours: number; minutes: number; seconds: number }
  | { phase: 'running' }
  | { phase: 'over' };

/** Restzeit bis zum Beginn des Zeitfensters (Berliner Zeit). */
export function countdown(
  date: string,
  startTime: string,
  endTime: string,
  now: Date = new Date(),
): CountdownState {
  const start = new Date(berlinIso(date, startTime)).getTime();
  const end = new Date(berlinIso(date, endTime)).getTime();
  const t = now.getTime();
  if (t >= end) return { phase: 'over' };
  if (t >= start) return { phase: 'running' };
  let s = Math.floor((start - t) / 1000);
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  return { phase: 'before', days, hours, minutes, seconds: s - minutes * 60 };
}
