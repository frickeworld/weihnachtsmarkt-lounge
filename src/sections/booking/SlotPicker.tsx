import type { SlotAvailability } from '@/lib/availability';
import { formatTime } from '@/lib/dates';

const statusLabel: Record<SlotAvailability['status'], string> = {
  free: 'frei',
  taken: 'gebucht',
  blocked: 'nicht verfügbar',
  closed: 'geschlossen',
  past: 'nicht mehr buchbar',
  out_of_season: 'nicht verfügbar',
};

export function SlotPicker({
  slots,
  selected,
  onSelect,
}: {
  slots: SlotAvailability[];
  selected: string | null;
  onSelect: (startTime: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Zeitfenster">
      {slots.map((s) => {
        const free = s.status === 'free';
        const active = selected === s.startTime;
        return (
          <button
            key={s.startTime}
            type="button"
            disabled={!free}
            onClick={() => onSelect(s.startTime)}
            aria-pressed={active}
            className={[
              'flex min-h-20 flex-col items-center justify-center rounded-[3px] border px-4 py-3 transition-colors',
              active
                ? 'border-gold bg-gold text-night'
                : free
                  ? 'border-gold/40 bg-night/60 hover:border-champagne hover:bg-gold/10'
                  : 'cursor-not-allowed border-cream/10 bg-night/30 text-cream/40 line-through decoration-cream/30',
            ].join(' ')}
          >
            <span className="font-display text-2xl font-semibold">
              {formatTime(s.startTime)}–{formatTime(s.endTime)} Uhr
            </span>
            <span className={`text-sm ${active ? 'text-night/80' : 'text-cream/65'}`}>
              {statusLabel[s.status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
