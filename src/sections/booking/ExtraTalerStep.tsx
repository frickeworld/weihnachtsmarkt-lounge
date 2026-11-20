import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import taler192 from '@/assets/taler-192.webp';
import { GlitterBand } from '@/components/GlitterBand';
import { IconCheck, IconCoin, IconHome, IconHut } from '@/components/Icons';
import { formatLongDate, formatTime, type IsoDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';

/** Glühwein-Preis am Markt in Talern (Info Louis, 05.11.2026) – nur für das Rechenbeispiel. */
const GLUEHWEIN_TALER = 4.5;
/** Ab dieser Gruppengröße wird der Upsell deutlicher (Entscheidung Louis, 17.11.2026). */
export const BIG_GROUP = 9;

const perPerson = (taler: number, persons: number) => Math.round(taler / persons);
const gluehwein = (taler: number, persons: number) => Math.floor(taler / persons / GLUEHWEIN_TALER);

interface Props {
  /** Stufen aus settings.extra_taler_options, z. B. [75, 100] */
  options: number[];
  /** Freiverzehr des gewählten Zeitfensters in Talern */
  baseTaler: number;
  persons: number;
  date: IsoDate;
  startTime: string;
  endTime: string;
  /** Lounge-Preis ohne Verarbeitungsgebühr, nach einem Rabatt (Anzeige) */
  loungeCents: number;
  /** Gewinn-Code: Lounge kostet nichts */
  won: boolean;
  /** z. B. „5 %“ – nur, wenn eine Gebühr anfällt */
  feeText: string | null;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: (extraTaler: number) => void;
}

function Benefit({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brown text-gold-light">
        {icon}
      </span>
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm leading-relaxed text-ink-soft">{children}</span>
      </span>
    </li>
  );
}

/**
 * Eigene Seite zwischen Formular und Stripe (Entscheidung Louis, 17.11.2026): Extra-Taler
 * dazubuchen. Die Taler gelten auf dem ganzen Weihnachtsmarkt, Reste bleiben nutzbar.
 * 1 Taler = 1 €, ohne Verarbeitungsgebühr, ohne Rabatt, voll an die Händler. Nichts ist
 * vorausgewählt; der Betrag entsteht nur auf dem Server.
 */
export function ExtraTalerStep({
  options,
  baseTaler,
  persons,
  date,
  startTime,
  endTime,
  loungeCents,
  won,
  feeText,
  busy,
  error,
  onBack,
  onConfirm,
}: Props) {
  const [extra, setExtra] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const big = persons >= BIG_GROUP;
  // Große Runde: die größte Stufe empfehlen, sonst die kleinste.
  const tip = big ? options[options.length - 1] : options[0];
  const extraCents = extra * 100;
  const payNothing = won && extra === 0;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Portal: Eltern mit Animation (transform) würden „fixed“ sonst auf sich beziehen.
  return createPortal(
    <section
      aria-labelledby="extra-taler-titel"
      className="fixed inset-0 z-[70] overflow-y-auto bg-paper"
    >
      <GlitterBand soft className="px-4 pt-5 pb-6 text-ink sm:pt-8 sm:pb-9">
        <div className="relative mx-auto max-w-3xl">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-full bg-surface/85 px-4 text-sm font-semibold text-ink shadow-sm"
          >
            <span aria-hidden="true">←</span> Zurück zu deinen Angaben
          </button>
          <div className="flex items-center gap-4">
            <img
              src={taler192}
              alt=""
              width={96}
              height={96}
              className="h-16 w-16 shrink-0 drop-shadow-lg sm:h-24 sm:w-24"
            />
            <div>
              <p className="text-xs font-bold tracking-[0.2em] uppercase">
                Letzter Schritt vor der Zahlung
              </p>
              <h2
                id="extra-taler-titel"
                ref={headingRef}
                tabIndex={-1}
                className="mt-1 font-display text-3xl leading-tight font-medium outline-none sm:text-5xl"
              >
                {big
                  ? `Ihr seid ${persons} – nehmt genug Taler mit`
                  : 'Mehr Taler für euren Weihnachtsmarkt'}
              </h2>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed font-medium sm:text-lg">
            {big ? (
              <>
                Eure {baseTaler} Taler Freiverzehr sind bei {persons} Personen nur rund{' '}
                {perPerson(baseTaler, persons)} Taler pro Kopf – das reicht für etwa{' '}
                {gluehwein(baseTaler, persons)} Glühwein. Bucht jetzt Taler dazu und genießt den
                ganzen Abend, ohne ans Portemonnaie zu denken.
              </>
            ) : (
              <>
                Zu euren {baseTaler} Talern Freiverzehr könnt ihr jetzt Taler dazubuchen – für
                Glühwein, Punsch, Crêpes und Bratwurst auf dem ganzen Weihnachtsmarkt.
              </>
            )}
          </p>
        </div>
      </GlitterBand>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <ul className="grid gap-5 sm:grid-cols-2">
          <Benefit icon={<IconHut className="h-6 w-6" />} title="Auf dem ganzen Weihnachtsmarkt">
            Nicht nur beim Tischservice in der Lounge: Ihr löst die Taler an allen Ständen im
            Schlosspark ein.
          </Benefit>
          <Benefit icon={<IconCoin className="h-6 w-6" />} title="Was übrig bleibt, behaltet ihr">
            Nicht verbrauchte Taler nehmt ihr mit und löst sie nach eurem Lounge-Besuch weiter auf
            dem Weihnachtsmarkt ein.
          </Benefit>
          <Benefit icon={<IconCheck className="h-6 w-6" />} title="Liegen beim Einlass bereit">
            Alle Taler bekommt ihr zusammen mit dem Freiverzehr – kein Anstehen, kein Bargeld.
          </Benefit>
          <Benefit icon={<IconHome className="h-6 w-6" />} title="Ohne Verarbeitungsgebühr">
            1 Taler = 1 €. Jeder Taler bleibt bei den Händlern auf dem Markt.
          </Benefit>
        </ul>

        <fieldset>
          <legend className="mb-3 font-display text-2xl font-medium">
            Wie viele Taler möchtet ihr dazu?
          </legend>
          <div className="space-y-3">
            {options.map((t) => {
              const total = baseTaler + t;
              return (
                <label key={t} className="block cursor-pointer">
                  <input
                    type="radio"
                    name="extraTalerStep"
                    value={String(t)}
                    checked={extra === t}
                    onChange={() => setExtra(t)}
                    className="peer sr-only"
                    aria-label={`${t} Extra-Taler für ${t} Euro`}
                  />
                  <span className="relative flex min-h-24 items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4 transition-colors peer-checked:border-gold-deep peer-checked:bg-gold/25 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep hover:border-gold sm:p-5">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gold-deep bg-surface"
                    >
                      {extra === t && <span className="h-3.5 w-3.5 rounded-full bg-gold-deep" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <span className="font-display text-2xl font-medium sm:text-3xl">
                          +{t} Taler
                        </span>
                        <span className="font-display text-xl font-medium">
                          {formatCents(t * 100)}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                        Zusammen <strong className="text-ink">{total} Taler</strong> – bei {persons}{' '}
                        Personen rund {perPerson(total, persons)} Taler pro Kopf, etwa{' '}
                        {gluehwein(total, persons)} Glühwein oder Glühwein und etwas zu essen.
                      </span>
                    </span>
                    {t === tip && (
                      <span className="absolute -top-3 right-4 rounded-full bg-brown px-3 py-1 text-xs font-semibold text-gold-light">
                        {big ? 'Für große Runden' : 'Unser Tipp'}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            <label className="block cursor-pointer">
              <input
                type="radio"
                name="extraTalerStep"
                value="0"
                checked={extra === 0}
                onChange={() => setExtra(0)}
                className="peer sr-only"
                aria-label="Keine Extra-Taler"
              />
              <span className="flex min-h-14 items-center gap-4 rounded-2xl border-2 border-line bg-paper px-4 transition-colors peer-checked:border-ink-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep hover:border-gold sm:px-5">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink-soft bg-surface"
                >
                  {extra === 0 && <span className="h-3.5 w-3.5 rounded-full bg-ink-soft" />}
                </span>
                <span className="text-ink-soft">
                  Nein danke, nur die {baseTaler} Taler Freiverzehr
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div
          className="rounded-2xl border border-gold bg-gold/10 p-5 sm:p-6"
          aria-label="Zusammenfassung"
        >
          <h3 className="text-xl font-medium">Deine Buchung</h3>
          <p className="mt-1 text-sm text-ink-soft">
            {formatLongDate(date)}, {formatTime(startTime)}–{formatTime(endTime)} Uhr · {persons}{' '}
            {persons === 1 ? 'Person' : 'Personen'}
          </p>
          <div className="my-4 h-px bg-gold/50" aria-hidden="true" />
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <dt>{won ? 'Lounge (Gewinn)' : 'Lounge-Preis'}</dt>
              <dd>{formatCents(won ? 0 : loungeCents)}</dd>
            </div>
            {extraCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt>Extra-Taler ({extra} Taler)</dt>
                <dd>{formatCents(extraCents)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 pt-2 text-xl font-bold text-ink">
              <dt>Zusammen</dt>
              <dd>{formatCents((won ? 0 : loungeCents) + extraCents)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-sm text-ink-soft">
              <dt>Weihnachtsmarkt-Taler beim Einlass</dt>
              <dd>{baseTaler + extra} Taler</dd>
            </div>
          </dl>
          {feeText && (
            <p className="pt-2 text-sm text-ink-soft">
              zzgl. {feeText} Verarbeitungsgebühr auf den Lounge-Preis, die beim Bezahlen
              hinzugerechnet wird – die Extra-Taler sind gebührenfrei
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onConfirm(extra)}
            disabled={busy}
            aria-busy={busy}
            className="btn-gold w-full text-lg sm:w-auto sm:px-10"
          >
            {busy
              ? payNothing
                ? 'Wird gebucht …'
                : 'Weiter zur Zahlung …'
              : payNothing
                ? 'Gewinn einlösen – kostenlos buchen'
                : 'Zahlungspflichtig buchen'}
          </button>
          <p className="text-sm text-ink-soft">
            Sichere Zahlung über Stripe mit Karte, Apple Pay, Google Pay oder PayPal. Rabatt- und
            Gewinnspiel-Codes gelten nur für die Lounge.
          </p>
        </div>
      </div>
    </section>,
    document.body,
  );
}
