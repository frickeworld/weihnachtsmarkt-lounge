import { useState } from 'react';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, smallBtn } from '../ui';
import { centsToEuroInput, parseEuroToCents } from './format';
import { autoHaendlerShare } from './pricing';
import type { SlotSpecial } from './types';

/**
 * Sonderpreis für ein einzelnes Zeitfenster (Party, Live-Auftritt). Gilt nur für neue Buchungen –
 * bestehende behalten ihre Beträge.
 */
export function SpecialPriceEditor({
  date,
  startTime,
  special,
  feeCents,
  booked,
  onChanged,
}: {
  date: string;
  startTime: string;
  special: SlotSpecial | undefined;
  feeCents: number;
  booked: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(special?.title ?? '');
  const [price, setPrice] = useState(special ? centsToEuroInput(special.price_cents) : '');
  const [taler, setTaler] = useState(special ? String(special.taler_count) : '');
  const [share, setShare] = useState(
    special?.haendler_share_cents != null ? centsToEuroInput(special.haendler_share_cents) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceCents = parseEuroToCents(price);
  const talerOk = /^\d+$/.test(taler.trim());

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('Bitte einen Titel angeben, z. B. „Party-Abend“.');
    if (priceCents === null || priceCents <= feeCents)
      return setError('Bitte einen Preis angeben (inkl. Vorverkaufsgebühr), z. B. 249,00.');
    if (!talerOk || Number(taler) * 100 > priceCents)
      return setError('Freiverzehr bitte als ganze Euro, höchstens der Preis.');
    let shareCents: number | null = null;
    if (share.trim()) {
      shareCents = parseEuroToCents(share);
      if (shareCents === null || shareCents > priceCents)
        return setError('Händler-Anteil bitte prüfen (höchstens der Preis).');
    }
    setBusy(true);
    const { error: e } = await requireClient()
      .from('slot_specials')
      .upsert({
        date,
        start_time: startTime,
        title: title.trim(),
        price_cents: priceCents,
        taler_count: Number(taler),
        haendler_share_cents: shareCents,
      });
    setBusy(false);
    if (e) return setError(errorText(e));
    setOpen(false);
    onChanged();
  };

  const remove = async () => {
    setBusy(true);
    const { error: e } = await requireClient()
      .from('slot_specials')
      .delete()
      .eq('date', date)
      .eq('start_time', startTime);
    setBusy(false);
    if (e) return setError(errorText(e));
    onChanged();
  };

  return (
    <div className="mt-2">
      {special && !open && (
        <p className="text-sm">
          <strong className="text-haendler-red">{special.title}</strong> ·{' '}
          {formatCents(special.price_cents)} · {special.taler_count} € Freiverzehr · Händler{' '}
          {formatCents(
            special.haendler_share_cents ??
              autoHaendlerShare(special.price_cents, feeCents, special.taler_count),
          )}
        </p>
      )}
      {!open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={smallBtn} disabled={busy} onClick={() => setOpen(true)}>
            {special ? 'Sonderpreis ändern' : 'Sonderpreis festlegen'}
          </button>
          {special && (
            <button
              type="button"
              className={smallBtn}
              disabled={busy}
              onClick={() => void remove()}
            >
              Sonderpreis entfernen
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-2 rounded-lg bg-sand p-3">
          <label className="block text-sm">
            <span className="field-label">Titel (steht im Kalender der Website)</span>
            <input
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Party-Abend"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm">
              <span className="field-label">Preis €</span>
              <input
                className="field-input"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="field-label">Freiverzehr €</span>
              <input
                className="field-input"
                inputMode="numeric"
                value={taler}
                onChange={(e) => setTaler(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="field-label">Händler €</span>
              <input
                className="field-input"
                inputMode="decimal"
                value={share}
                onChange={(e) => setShare(e.target.value)}
                placeholder={
                  priceCents !== null && talerOk
                    ? `auto ${centsToEuroInput(autoHaendlerShare(priceCents, feeCents, Number(taler)))}`
                    : 'auto'
                }
              />
            </label>
          </div>
          <p className="text-xs text-ink-soft">
            Preis inkl. {formatCents(feeCents)} Vorverkaufsgebühr. Händler-Anteil leer lassen =
            Freiverzehr + Hälfte des Rests.
            {booked && ' Die bestehende Buchung behält ihren Preis.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-gold" disabled={busy} onClick={() => void save()}>
              {busy ? 'Speichern …' : 'Sonderpreis speichern'}
            </button>
            <button type="button" className={smallBtn} onClick={() => setOpen(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </div>
  );
}
