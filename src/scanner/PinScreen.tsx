import { useState } from 'react';
import { HaendlerLogo } from '@/components/HaendlerLogo';
import { scannerApi } from './api';
import { unlockAudio } from './feedback';
import type { ScannerSession } from './storage';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** PIN-Eingabe mit großer Zifferntastatur (auch mit Handschuhen bedienbar). */
export function PinScreen({
  notice,
  onLogin,
}: {
  notice?: string | null;
  onLogin: (s: ScannerSession) => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      onLogin(await scannerApi.auth(value));
    } catch (e) {
      setError(
        e instanceof Error && e.message !== 'offline'
          ? e.message
          : 'Keine Verbindung. Für die Anmeldung braucht es Netz.',
      );
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const press = (k: string) => {
    unlockAudio();
    if (busy) return;
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    if (!k || pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 6) void submit(next);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <header className="on-dark flex justify-center bg-brown py-4">
        <HaendlerLogo size="md" />
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center px-6 py-8">
        <p className="eyebrow">Lounge · Einlass</p>
        <h1 className="mt-2 text-3xl font-medium">PIN eingeben</h1>
        <div
          className="my-8 flex gap-3"
          aria-label={`${pin.length} von 6 Ziffern eingegeben`}
          role="status"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-4 w-4 rounded-full border-2 border-gold-deep ${i < pin.length ? 'bg-gold-deep' : ''}`}
            />
          ))}
        </div>
        {error && (
          <p role="alert" className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-center text-red-900">
            {error}
          </p>
        )}
        <div className="grid w-full grid-cols-3 gap-3">
          {KEYS.map((k, i) =>
            k ? (
              <button
                key={i}
                type="button"
                onClick={() => press(k)}
                disabled={busy}
                aria-label={k === '⌫' ? 'Letzte Ziffer löschen' : k}
                className="min-h-16 rounded-2xl border border-line bg-surface text-2xl font-semibold text-ink active:bg-sand disabled:opacity-50"
              >
                {k}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <p className="mt-8 text-center text-sm text-ink-soft">
          Die PIN bekommst du von Studio F. Nach 5 falschen Eingaben ist der Scanner 10 Minuten
          gesperrt.
        </p>
      </div>
    </main>
  );
}
