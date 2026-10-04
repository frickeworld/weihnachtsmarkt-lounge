import { useEffect, useRef, useState } from 'react';
import { clock, shortDay } from './format';
import type { ScanBooking, ScanResult } from './types';

const STYLE: Record<ScanResult['result'], { box: string; btn: string; title: string }> = {
  ok: {
    box: 'bg-emerald-700 text-white',
    btn: 'bg-white text-emerald-900',
    title: 'Gültig – herzlich willkommen!',
  },
  override: {
    box: 'bg-emerald-700 text-white',
    btn: 'bg-white text-emerald-900',
    title: 'Eingecheckt (anderer Termin)',
  },
  already: { box: 'bg-amber-300 text-ink', btn: 'bg-ink text-white', title: 'Bereits eingecheckt' },
  wrong_slot: { box: 'bg-orange-400 text-ink', btn: 'bg-ink text-white', title: 'Anderer Termin' },
  invalid: { box: 'bg-red-700 text-white', btn: 'bg-white text-red-900', title: 'Ungültig' },
};

const REASON: Record<string, string> = {
  unknown: 'Diesen Code gibt es nicht.',
  cancelled: 'Diese Buchung wurde storniert.',
  unpaid: 'Diese Buchung ist nicht bezahlt.',
  nolist: 'Kein Netz und noch keine Liste geladen. Bitte Verbindung prüfen.',
};

function Guest({ b }: { b: ScanBooking }) {
  return (
    <div className="mt-5 space-y-1 text-lg">
      <p className="text-2xl font-semibold">
        {b.first_name} {b.last_name}
      </p>
      {b.company_name && <p>{b.company_name}</p>}
      <p>
        {b.persons} {b.persons === 1 ? 'Person' : 'Personen'} · {shortDay(b.date)}, {b.start_time}–
        {b.end_time} Uhr
      </p>
      <p className="font-mono text-base opacity-80">{b.booking_code}</p>
    </div>
  );
}

/** Vollflächiges Ergebnis in Ampelfarben. Text und Symbol, nie nur Farbe. */
export function ResultSheet({
  result,
  onTaler,
  onOverride,
  onClose,
}: {
  result: ScanResult;
  onTaler: (bookingId: string) => Promise<ScanBooking | undefined>;
  onOverride: () => void;
  onClose: () => void;
}) {
  const s = STYLE[result.result];
  const [booking, setBooking] = useState(result.booking);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);

  const icon =
    result.result === 'invalid'
      ? '✕'
      : result.result === 'wrong_slot'
        ? '!'
        : result.result === 'already'
          ? '↺'
          : '✓';
  const paid = booking && booking.status === 'paid';
  const canTaler = paid && result.result !== 'wrong_slot' && result.result !== 'invalid';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="scan-result-title"
      className={`fixed inset-0 z-50 flex flex-col overflow-y-auto p-6 ${s.box}`}
    >
      <div className="flex-1">
        <div aria-hidden="true" className="text-6xl leading-none font-bold">
          {icon}
        </div>
        <h2 id="scan-result-title" className="mt-4 text-4xl leading-tight font-semibold">
          {s.title}
        </h2>
        {result.result === 'already' && booking?.checked_in_at && (
          <p className="mt-2 text-xl">um {clock(booking.checked_in_at)} Uhr</p>
        )}
        {result.result === 'wrong_slot' && booking && (
          <p className="mt-2 text-xl">
            Gebucht für {shortDay(booking.date)}, {booking.start_time}–{booking.end_time} Uhr
          </p>
        )}
        {result.result === 'invalid' && (
          <p className="mt-2 text-xl">{REASON[result.reason ?? 'unknown']}</p>
        )}
        {result.offline && (
          <p className="mt-4 inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">
            Offline geprüft
            {result.result === 'ok' || result.result === 'override' ? ' – wird nachgetragen' : ''}
            {result.result === 'invalid' && result.reason === 'unknown'
              ? ' – offline werden nur heutige Buchungen erkannt'
              : ''}
          </p>
        )}
        {booking && <Guest b={booking} />}
        {canTaler && (
          <p className="mt-4 text-lg font-semibold">
            {booking.taler_handed_out_at
              ? `Residenztaler übergeben um ${clock(booking.taler_handed_out_at)} Uhr`
              : 'Residenztaler noch nicht übergeben'}
          </p>
        )}
      </div>
      <div className="mt-6 grid gap-3">
        {canTaler && !booking.taler_handed_out_at && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onTaler(booking.id)
                .then((b) => b && setBooking(b))
                .finally(() => setBusy(false));
            }}
            className={`min-h-16 rounded-2xl text-xl font-semibold ${s.btn}`}
          >
            Taler übergeben
          </button>
        )}
        {result.result === 'wrong_slot' && (
          <button
            type="button"
            onClick={onOverride}
            className={`min-h-16 rounded-2xl text-xl font-semibold ${s.btn}`}
          >
            Trotzdem einchecken
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="min-h-16 rounded-2xl border-2 border-current text-xl font-semibold"
        >
          {result.result === 'wrong_slot' ? 'Abbrechen' : 'Weiter scannen'}
        </button>
      </div>
    </div>
  );
}
