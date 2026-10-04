import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { HaendlerLogo } from '@/components/HaendlerLogo';
import { useNoindex } from '@/lib/useNoindex';
import { signal, unlockAudio } from './feedback';
import { clock } from './format';
import { PinScreen } from './PinScreen';
import { QrCamera } from './QrCamera';
import { ResultSheet } from './ResultSheet';
import { store, type ScannerSession } from './storage';
import type { ScanBooking, ScanResult } from './types';
import { useScanner } from './useScanner';

/** /scan – Einlass-Scanner für Mitarbeitende (kein Konto, PIN). */
export default function ScannerApp() {
  useNoindex();
  const [session, setSession] = useState<ScannerSession | null>(() => store.session());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Einlass – Weihnachtsmarkt-Lounge';
  }, []);

  const logout = useCallback((message?: string) => {
    store.clear();
    setNotice(message ?? null);
    setSession(null);
  }, []);

  if (!session)
    return (
      <PinScreen
        notice={notice}
        onLogin={(s) => {
          store.setSession(s);
          setNotice(null);
          setSession(s);
        }}
      />
    );
  return <Scanner session={session} onLogout={logout} />;
}

function Scanner({
  session,
  onLogout,
}: {
  session: ScannerSession;
  onLogout: (m?: string) => void;
}) {
  const { today, queue, online, scan, taler } = useScanner(session, onLogout);
  const [tab, setTab] = useState<'scan' | 'today'>('scan');
  const [result, setResult] = useState<{ code: string; r: ScanResult } | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token läuft nach 12 Stunden ab
  useEffect(() => {
    const ms = Date.parse(session.expiresAt) - Date.now();
    const t = setTimeout(
      () => onLogout('Die Anmeldung ist abgelaufen. Bitte PIN neu eingeben.'),
      Math.max(0, ms),
    );
    return () => clearTimeout(t);
  }, [session.expiresAt, onLogout]);

  const run = async (code: string, override = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await scan(code, override);
      signal(r.result);
      setResult({ code, r });
    } catch {
      setError('Das hat nicht geklappt. Bitte nochmal scannen.');
    } finally {
      setBusy(false);
    }
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    if (manual.trim()) void run(manual).then(() => setManual(''));
  };

  const list = today?.bookings ?? [];
  const paidCount = list.filter((b) => b.status === 'paid').length;
  const inCount = list.filter((b) => b.status === 'paid' && b.checked_in_at).length;

  return (
    <div className="flex min-h-dvh flex-col bg-paper" onPointerDown={unlockAudio}>
      <header className="on-dark bg-brown px-4 py-3 text-on-dark">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <HaendlerLogo />
          <button
            type="button"
            onClick={() => {
              if (
                queue.length &&
                !window.confirm(
                  `${queue.length} Check-ins sind noch nicht übertragen. Trotzdem abmelden?`,
                )
              )
                return;
              onLogout();
            }}
            className="min-h-11 rounded-full border border-on-dark/40 px-4 text-sm font-semibold"
          >
            Abmelden
          </button>
        </div>
      </header>
      <div
        role="status"
        className={`px-4 py-2 text-center text-sm font-semibold ${online ? 'bg-sand text-ink' : 'bg-orange-400 text-ink'}`}
      >
        {online ? 'Online' : 'Offline – Prüfung mit der gespeicherten Liste'}
        {queue.length > 0 &&
          ` · ${queue.length} ${queue.length === 1 ? 'Eintrag wartet' : 'Einträge warten'} auf Übertragung`}
      </div>

      <nav
        className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2 px-4 pt-4"
        aria-label="Ansicht"
      >
        {(
          [
            ['scan', 'Scannen'],
            ['today', `Heute (${inCount}/${paidCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-12 rounded-full border text-base font-semibold ${tab === id ? 'border-gold-deep bg-gold text-ink' : 'border-line bg-surface'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        {tab === 'scan' ? (
          <>
            <QrCamera
              paused={Boolean(result) || busy || tab !== 'scan'}
              onCode={(c) => void run(c)}
            />
            <form onSubmit={submitManual} className="mt-4 flex gap-2">
              <label htmlFor="manual-code" className="sr-only">
                Buchungscode von Hand eingeben
              </label>
              <input
                id="manual-code"
                className="field-input flex-1 font-mono uppercase"
                placeholder="HL-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
              <button type="submit" className="btn-gold !px-5" disabled={busy || !manual.trim()}>
                Prüfen
              </button>
            </form>
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-red-900">
                {error}
              </p>
            )}
          </>
        ) : (
          <TodayView bookings={list} onCheckIn={(b) => void run(b.booking_code)} />
        )}
      </main>

      {result && (
        <ResultSheet
          key={`${result.code}-${result.r.result}`}
          result={result.r}
          onTaler={async (id) => {
            const b = await taler(id).catch(() => undefined);
            if (b) signal('ok');
            return b;
          }}
          onOverride={() => {
            const code = result.code;
            setResult(null);
            void run(code, true);
          }}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}

function TodayView({
  bookings,
  onCheckIn,
}: {
  bookings: ScanBooking[];
  onCheckIn: (b: ScanBooking) => void;
}) {
  if (bookings.length === 0)
    return <p className="py-10 text-center text-ink-soft">Heute ist keine Lounge gebucht.</p>;
  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        const cancelled = b.status !== 'paid';
        return (
          <li key={b.id} className={`card p-4 ${cancelled ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold tabular-nums">
                  {b.start_time}–{b.end_time} Uhr
                </p>
                <p className="text-lg">
                  {b.first_name} {b.last_name}
                </p>
                {b.company_name && <p className="text-ink-soft">{b.company_name}</p>}
                <p className="text-sm text-ink-soft">
                  {b.persons} Pers. · <span className="font-mono">{b.booking_code}</span>
                </p>
              </div>
              <div className="text-right text-sm">
                {cancelled ? (
                  <span className="font-semibold text-red-800">Storniert</span>
                ) : b.checked_in_at ? (
                  <span className="font-semibold text-emerald-800">
                    ✓ Da {clock(b.checked_in_at)}
                  </span>
                ) : (
                  <span className="text-ink-soft">Noch nicht da</span>
                )}
                {!cancelled && (
                  <p className={b.taler_handed_out_at ? 'text-emerald-800' : 'text-ink-soft'}>
                    {b.taler_handed_out_at ? '✓ Taler' : 'Taler offen'}
                  </p>
                )}
              </div>
            </div>
            {!cancelled && (!b.checked_in_at || !b.taler_handed_out_at) && (
              <button
                type="button"
                onClick={() => onCheckIn(b)}
                className="btn-outline mt-3 w-full !min-h-11"
              >
                {b.checked_in_at ? 'Öffnen (Taler)' : 'Ohne QR-Code einchecken'}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
