import { formatCents } from '@/lib/money';

/** Glühwein-Preis am Markt in Talern (Info Louis, 05.11.2026) – nur für das Rechenbeispiel. */
const GLUEHWEIN_TALER = 4.5;
/** Ohne gewählte Personenzahl rechnen wir das Beispiel für eine typische Runde. */
const EXAMPLE_PERSONS = 8;

interface Props {
  /** Stufen aus settings.extra_taler_options, z. B. [100, 200, 300] */
  options: number[];
  value: number;
  onChange: (taler: number) => void;
  /** Freiverzehr des gewählten Zeitfensters in Talern */
  baseTaler: number;
  /** Gewählte Personenzahl (leer, solange nichts gewählt ist) */
  persons?: number;
}

const perPerson = (taler: number, persons: number) => Math.round(taler / persons);
const gluehwein = (taler: number, persons: number) => Math.floor(taler / persons / GLUEHWEIN_TALER);

/**
 * Extra-Taler zum Dazubuchen (Entscheidung Louis, 05.11.2026): 1 Taler = 1 €, ohne
 * Verarbeitungsgebühr und ohne Rabatt, geht vollständig an die Händler. Der Preis entsteht nur auf
 * dem Server; hier wird nur die Menge gewählt.
 */
export function ExtraTalerPicker({ options, value, onChange, baseTaler, persons }: Props) {
  if (options.length === 0) return null;
  const n = persons && persons > 0 ? persons : EXAMPLE_PERSONS;
  const total = baseTaler + value;
  const tip = options.length >= 3 ? options[1] : undefined;

  return (
    <fieldset className="rounded-2xl border border-gold bg-sand p-5 sm:p-6">
      <legend className="sr-only">Extra-Taler dazubuchen (optional)</legend>
      <p className="text-xs font-semibold tracking-[0.18em] text-gold-deep uppercase">
        Extra-Taler (optional)
      </p>
      <h4 className="mt-1 text-2xl font-medium">Mehr Taler für eure Runde</h4>
      <p className="mt-2 leading-relaxed text-ink-soft">
        Eure {baseTaler} Taler Freiverzehr sind in großer Runde schnell eingelöst: Ein Glühwein
        kostet 4,50 Taler, dazu kommen Crêpes, Bratwurst, Flammkuchen, Punsch oder eine Flasche
        Sekt. Buch einfach Taler dazu – sie liegen beim Einlass für euch bereit, und ihr müsst den
        ganzen Abend nicht mehr ans Portemonnaie.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, ...options].map((t) => (
          <label key={t} className="cursor-pointer">
            <input
              type="radio"
              name="extraTaler"
              value={String(t)}
              checked={value === t}
              onChange={() => onChange(t)}
              className="peer sr-only"
              aria-label={t === 0 ? 'Keine Extra-Taler' : `${t} Extra-Taler für ${t} Euro`}
            />
            <span className="relative flex min-h-16 flex-col items-center justify-center rounded-xl border-2 border-line bg-surface px-2 py-2 text-center transition-colors peer-checked:border-gold-deep peer-checked:bg-gold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep hover:border-gold">
              {t === 0 ? (
                <span className="font-medium">Ohne</span>
              ) : (
                <>
                  <span className="font-display text-lg font-medium">+{t} Taler</span>
                  <span className="text-sm">{formatCents(t * 100)}</span>
                </>
              )}
              {t === tip && (
                <span className="absolute -top-2.5 rounded-full bg-brown px-2 py-0.5 text-[11px] font-semibold text-gold-light">
                  Unser Tipp
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <p
        className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed"
        aria-live="polite"
      >
        {value > 0 ? (
          <>
            Mit <strong>{total} Talern</strong> habt ihr bei {n} Personen rund{' '}
            <strong>{perPerson(total, n)} Taler pro Person</strong> – das sind etwa{' '}
            {gluehwein(total, n)} Glühwein pro Kopf, oder Glühwein und etwas Leckeres zu essen.
          </>
        ) : (
          <>
            Zum Vergleich: Bei {n} Personen sind {baseTaler} Taler rund {perPerson(baseTaler, n)}{' '}
            Taler pro Person, also etwa {gluehwein(baseTaler, n)} Glühwein pro Kopf. Mit +
            {options[0]} Talern werden daraus rund {perPerson(baseTaler + options[0]!, n)} Taler pro
            Person.
          </>
        )}
      </p>
      <p className="mt-3 text-sm text-ink-soft">
        1 Taler = 1 €, ohne Verarbeitungsgebühr. Rabatt- und Gewinnspiel-Codes gelten nur für die
        Lounge. Die Taler löst ihr an den Ständen des Weihnachtsmarkts ein.
      </p>
    </fieldset>
  );
}
