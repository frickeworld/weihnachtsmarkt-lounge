import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { joinWaitlist } from '@/lib/api';
import { formatLongDate, type IsoDate } from '@/lib/dates';

/**
 * „Dein Wunschtag ist ausgebucht?“ – einmalige Benachrichtigung per E-Mail, sobald an dem Tag
 * ein Zeitfenster frei wird. Erscheint nur, wenn im angezeigten Monat ausgebuchte Tage sind.
 */
export function Waitlist({
  bookedDays,
  onFreeNow,
}: {
  bookedDays: IsoDate[];
  onFreeNow: (date: IsoDate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<IsoDate | ''>('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<IsoDate | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!bookedDays.length) return null;
  const chosen = date && bookedDays.includes(date) ? date : bookedDays[0]!;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Bitte prüfe deine E-Mail-Adresse.');
    if (!consent) return setError('Bitte bestätige die Benachrichtigung.');
    setBusy(true);
    const r = await joinWaitlist({ date: chosen, email, consent, website });
    setBusy(false);
    if (r.ok) return setDone(chosen);
    if (r.freeNow) return onFreeNow(chosen);
    setError(r.fields ? (Object.values(r.fields)[0] ?? r.message) : r.message);
  };

  if (done)
    return (
      <p role="status" className="mt-5 rounded-xl border border-gold bg-gold/15 p-4">
        Du stehst auf der Warteliste für <strong>{formatLongDate(done)}</strong>. Wird ein
        Zeitfenster frei, bekommst du sofort eine E-Mail – wer zuerst bucht, bekommt die Lounge.
      </p>
    );

  return (
    <div className="mt-5 rounded-2xl border border-line bg-sand/60 p-4 sm:p-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-semibold"
          aria-expanded="false"
        >
          <span>Dein Wunschtag ist ausgebucht? Wir sagen dir Bescheid, wenn etwas frei wird.</span>
          <span aria-hidden="true" className="text-gold-deep">
            +
          </span>
        </button>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate className="relative space-y-4">
          <p className="font-semibold">Warteliste für einen ausgebuchten Tag</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Wunschtag</span>
              <select
                className="field-input"
                value={chosen}
                onChange={(e) => setDate(e.target.value)}
              >
                {bookedDays.map((d) => (
                  <option key={d} value={d}>
                    {formatLongDate(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">E-Mail</span>
              <input
                type="email"
                className="field-input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#7a5a1e]"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Ich möchte <strong>einmalig</strong> per E-Mail benachrichtigt werden, wenn an diesem
              Tag ein Zeitfenster frei wird. Danach wird meine Adresse gelöscht – spätestens nach
              dem Tag. Mehr in der{' '}
              <Link to="/datenschutz" className="font-semibold text-gold-deep underline">
                Datenschutzerklärung
              </Link>
              .
            </span>
          </label>
          {/* Honigtopf gegen Bots – für Menschen unsichtbar */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button type="submit" className="btn-outline" disabled={busy}>
            {busy ? 'Wird eingetragen …' : 'Auf die Warteliste setzen'}
          </button>
        </form>
      )}
    </div>
  );
}
