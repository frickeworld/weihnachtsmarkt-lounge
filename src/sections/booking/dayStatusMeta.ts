import type { DayStatus } from '@/lib/availability';

export const DAY_STATUS_META: Record<
  Exclude<DayStatus, 'unavailable'>,
  { label: string; dot: string }
> = {
  free: { label: 'frei', dot: 'bg-emerald-400' },
  last: { label: 'nur noch 1 Zeitfenster', dot: 'bg-amber-300' },
  booked: { label: 'ausgebucht', dot: 'bg-rose-400' },
  closed: { label: 'geschlossen', dot: 'bg-cream/30' },
};
