import type { Preset, usePeriod } from './usePeriod';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'saison', label: 'Saison' },
  { id: 'heute', label: 'Heute' },
  { id: '7', label: '7 Tage' },
  { id: '30', label: '30 Tage' },
  { id: 'eigen', label: 'Zeitraum' },
];

export function PeriodPicker({ state }: { state: ReturnType<typeof usePeriod> }) {
  const { preset, setPreset, custom, setCustom } = state;
  return (
    <div className="mb-6 flex flex-wrap items-end gap-2" role="group" aria-label="Zeitraum">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={preset === p.id}
          onClick={() => setPreset(p.id)}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
            preset === p.id
              ? 'border-gold-deep bg-gold text-ink'
              : 'border-line bg-surface hover:border-gold-deep'
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === 'eigen' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="field-label">Von</span>
            <input
              type="date"
              className="field-input"
              value={custom.from}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="field-label">Bis</span>
            <input
              type="date"
              className="field-input"
              value={custom.to}
              min={custom.from}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </label>
        </div>
      )}
    </div>
  );
}
