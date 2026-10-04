import { formatDateTime } from '../admin/format';
import type { HaendlerBooking } from './types';

/** Status als Text (nie nur Farbe): bezahlt/storniert, erschienen, nicht erschienen. */
export function BookingState({ b }: { b: HaendlerBooking }) {
  if (b.status === 'cancelled')
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-950">
        Storniert
      </span>
    );
  if (b.checked_in_at)
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-950">
        Erschienen {formatDateTime(b.checked_in_at).slice(-5)}
      </span>
    );
  if (b.no_show)
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
        Nicht erschienen
      </span>
    );
  return (
    <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink">
      Bezahlt
    </span>
  );
}
