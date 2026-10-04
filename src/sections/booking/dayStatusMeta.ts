import type { DayStatus } from '@/lib/availability';

export const DAY_STATUS_META: Record<
  Exclude<DayStatus, 'unavailable'>,
  { label: string; dot: string }
> = {
  free: { label: 'frei', dot: 'bg-emerald-600' },
  last: { label: 'nur noch 1 Zeitfenster', dot: 'bg-amber-500' },
  booked: { label: 'ausgebucht', dot: 'bg-rose-600' },
  closed: { label: 'geschlossen', dot: 'bg-stone-400' },
};
