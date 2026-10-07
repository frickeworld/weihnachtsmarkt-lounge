import { useEffect, useState } from 'react';
import { previewDiscount, type DiscountPreview } from '@/lib/api';
import type { IsoDate } from '@/lib/dates';
import { DISCOUNT_REASON_TEXT } from '@/lib/bookingSchema';

/** Code aus der Adresse übernehmen (Link aus der Gewinnspiel-Mail: /?code=…#buchen). */
function codeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('code') ?? '').toUpperCase().slice(0, 24);
}

/**
 * „Gewinnspiel-Code“ – zeigt nach „Einlösen“ den neuen Preis an. Verbindlich rechnet der Server;
 * hier nur die Vorschau. Meldet den gültigen Code (oder undefined) an das Formular.
 */
export function DiscountCodeField({
  date,
  startTime,
  onChange,
}: {
  date: IsoDate;
  startTime: string;
  onChange: (code: string | undefined, preview: DiscountPreview | null) => void;
}) {
  const [open, setOpen] = useState(() => codeFromUrl() !== '');
  const [code, setCode] = useState(codeFromUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const apply = async (value = code) => {
    const c = value.trim().toUpperCase();
    setMessage(null);
    if (!c) return;
    if (!/^[A-Z0-9-]{6,24}$/.test(c)) {
      setMessage(DISCOUNT_REASON_TEXT.unknown!);
      return;
    }
    setBusy(true);
    const p = await previewDiscount(c, date, startTime);
    setBusy(false);
    if (!p) return setMessage('Der Code konnte gerade nicht geprüft werden.');
    if (p.reason) {
      setApplied(null);
      onChange(undefined, null);
      return setMessage(DISCOUNT_REASON_TEXT[p.reason] ?? 'Bitte prüfe den Code.');
    }
    setApplied(c);
    onChange(c, p);
  };

  // Mit Code aus dem Link und bei Wechsel des Zeitfensters automatisch prüfen
  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => void apply(code), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, startTime]);

  const remove = () => {
    setApplied(null);
    setCode('');
    setMessage(null);
    onChange(undefined, null);
  };

  if (!open)
    return (
      <button
        type="button"
        className="text-sm font-semibold text-gold-deep underline underline-offset-4"
        onClick={() => setOpen(true)}
      >
        Gewinnspiel-Code einlösen
      </button>
    );

  return (
    <div className="rounded-2xl border border-line bg-sand/50 p-4">
      <label htmlFor="discountCode" className="field-label">
        Gewinnspiel-Code
      </label>
      {applied ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-lg font-semibold tracking-wider" role="status">
            {applied} <span className="font-sans text-sm text-emerald-800">eingelöst</span>
          </p>
          <button type="button" className="text-sm underline" onClick={remove}>
            Entfernen
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            id="discountCode"
            className="field-input font-mono uppercase"
            autoComplete="off"
            placeholder="z. B. LOUNGE-ABC123"
            value={code}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? 'discountCode-error' : undefined}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void apply();
              }
            }}
          />
          <button
            type="button"
            className="btn-outline !min-h-12 shrink-0"
            disabled={busy || !code.trim()}
            onClick={() => void apply()}
          >
            {busy ? 'Prüfen …' : 'Einlösen'}
          </button>
        </div>
      )}
      {message && (
        <p id="discountCode-error" className="field-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
