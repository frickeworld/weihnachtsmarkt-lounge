import { dayStatus, type SlotAvailability } from '@/lib/availability';
import { DAY_STATUS_META } from './dayStatusMeta';
import { formatLongDate, formatMonth, monthGrid, parseIsoDate, type IsoDate } from '@/lib/dates';
import { IconChevron } from '@/components/Icons';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface Props {
  year: number;
  month: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  byDate: Map<IsoDate, SlotAvailability[]>;
  selected: IsoDate | null;
  onSelect: (d: IsoDate) => void;
}

export function Calendar({
  year,
  month,
  canPrev,
  canNext,
  onPrev,
  onNext,
  byDate,
  selected,
  onSelect,
}: Props) {
  const weeks = monthGrid(year, month);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Vorheriger Monat"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-gold hover:bg-gold/15 disabled:invisible"
        >
          <IconChevron className="h-5 w-5 rotate-180" />
        </button>
        <h3 className="text-2xl font-medium" aria-live="polite">
          {formatMonth(year, month)}
        </h3>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Nächster Monat"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-gold hover:bg-gold/15 disabled:invisible"
        >
          <IconChevron className="h-5 w-5" />
        </button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th
                key={w}
                scope="col"
                className="pb-2 text-xs font-bold tracking-wider text-ink-soft uppercase"
              >
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => {
                if (!d) return <td key={di} />;
                const status = dayStatus(byDate.get(d) ?? []);
                const selectable = status === 'free' || status === 'last';
                const isSelected = d === selected;
                const meta = status === 'unavailable' ? null : DAY_STATUS_META[status];
                const label = `${formatLongDate(d)}${meta ? `, ${meta.label}` : ', nicht buchbar'}`;
                return (
                  <td key={di} className="p-0">
                    <button
                      type="button"
                      disabled={!selectable}
                      onClick={() => onSelect(d)}
                      aria-label={label}
                      aria-pressed={isSelected}
                      className={[
                        'relative flex aspect-square w-full min-h-11 flex-col items-center justify-center rounded-xl text-base transition-colors',
                        isSelected
                          ? 'bg-gold font-bold text-ink shadow-[inset_0_0_0_2px_#7a5a1e]'
                          : selectable
                            ? 'border border-line bg-surface font-semibold hover:border-gold hover:bg-gold/15'
                            : status === 'unavailable'
                              ? 'text-ink/25'
                              : 'bg-sand text-ink/45',
                      ].join(' ')}
                    >
                      {parseIsoDate(d).getUTCDate()}
                      {meta && (
                        <span
                          aria-hidden="true"
                          className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-ink' : meta.dot}`}
                        />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul
        className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft"
        aria-label="Legende"
      >
        {Object.values(DAY_STATUS_META).map((m) => (
          <li key={m.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${m.dot}`} />
            {m.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
