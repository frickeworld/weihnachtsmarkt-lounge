import { useState } from 'react';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, smallBtn } from '../ui';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Einmaliges Zeitfenster an einem Tag anlegen (z. B. Heiligabend 10–13 Uhr). Den Preis legt
 * danach der Sonderpreis am Zeitfenster fest.
 */
export function ExtraSlotForm({ date, onChanged }: { date: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');
  const [replaces, setReplaces] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <button type="button" className={`${smallBtn} mt-3`} onClick={() => setOpen(true)}>
        Einmaliges Zeitfenster hinzufügen
      </button>
    );

  const save = async () => {
    setError(null);
    if (!TIME.test(start) || !TIME.test(end) || start >= end)
      return setError('Bitte Beginn und Ende angeben (Ende nach Beginn).');
    setBusy(true);
    const { error: e } = await requireClient()
      .from('extra_slots')
      .insert({
        date,
        start_time: start,
        end_time: end,
        label: label.trim() || null,
        replaces_regular: replaces,
      });
    setBusy(false);
    if (e) return setError(errorText(e));
    setOpen(false);
    setStart('');
    setEnd('');
    setLabel('');
    onChanged();
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line bg-sand/50 p-3">
      <p className="text-sm font-semibold">Einmaliges Zeitfenster</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="field-label">Beginn</span>
          <input
            type="time"
            className="field-input"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="field-label">Ende</span>
          <input
            type="time"
            className="field-input"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="field-label">Bezeichnung (optional, z. B. „Vormittag“)</span>
        <input
          className="field-input"
          maxLength={40}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#7a5a1e]"
          checked={replaces}
          onChange={(e) => setReplaces(e.target.checked)}
        />
        <span>Ersetzt die normalen Zeitfenster an diesem Tag</span>
      </label>
      <p className="text-xs text-ink-soft">
        Danach bitte am neuen Zeitfenster einen Sonderpreis festlegen – sonst gilt der alte
        Standardpreis aus den Einstellungen.
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={smallBtn} disabled={busy} onClick={() => void save()}>
          Anlegen
        </button>
        <button type="button" className={smallBtn} disabled={busy} onClick={() => setOpen(false)}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
