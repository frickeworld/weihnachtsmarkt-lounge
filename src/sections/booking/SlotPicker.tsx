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
              'flex min-h-20 flex-col items-center justify-center rounded-2xl border px-4 py-3 transition-colors',
              active
                ? 'border-gold-deep bg-gold text-ink'
                : free
                  ? 'border-line bg-surface hover:border-gold hover:bg-gold/15'
                  : 'cursor-not-allowed border-transparent bg-sand text-ink/45 line-through decoration-ink/30',
            ].join(' ')}
          >
            <span className="font-display text-2xl font-medium">
              {formatTime(s.startTime)}–{formatTime(s.endTime)} Uhr
            </span>
            <span className={`text-sm ${active ? 'text-ink/80' : 'text-ink-soft'}`}>
              {statusLabel[s.status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
