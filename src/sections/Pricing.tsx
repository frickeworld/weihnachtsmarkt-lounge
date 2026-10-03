import { IconCheck } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { formatCents } from '@/lib/money';
import { totalCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { trackBookClick } from '@/lib/track';

export function Pricing() {
  const s = useSettings();
  const included = [
    'Lounge exklusiv für 2 Stunden',
    `Platz für bis zu ${s.maxPersons} Personen`,
    `${s.talerCount} Residenztaler Freiverzehr im Wert von ${s.talerCount} €`,
    'Tischservice der Tanzschule Fricke',
    'Ticket mit QR-Code per E-Mail',
  ];

  return (
    <section id="preis" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading title="Preis und Zeiten" />
        <Reveal className="relative rounded-[3px] p-px [background:linear-gradient(140deg,#e9d8a6,#c9a24d_35%,#6b5426_60%,#c9a24d)]">
          <div className="rounded-[2px] bg-coal px-6 py-10 text-center sm:px-12 sm:py-12">
            <p className="font-display text-7xl leading-none font-semibold text-champagne sm:text-8xl">
              {formatCents(totalCents(s))}
            </p>
            <p className="mt-4 text-cream/80">
              pro Lounge und Zeitfenster · inkl. {formatCents(s.feeCents)} Vorverkaufsgebühr
            </p>

            <ul className="mx-auto mt-9 max-w-md space-y-3 text-left">
              {included.map((item) => (
                <li key={item} className="flex gap-3">
                  <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mx-auto my-9 h-px w-full max-w-md bg-gold/25" aria-hidden="true" />

            <dl className="mx-auto grid max-w-md gap-4 text-left sm:grid-cols-2">
              <div>
                <dt className="eyebrow mb-1">Montag bis Freitag</dt>
                <dd>
                  <span className="whitespace-nowrap">17:00–19:00 Uhr</span> oder{' '}
                  <span className="whitespace-nowrap">19:00–21:00 Uhr</span>
                </dd>
              </div>
              <div>
                <dt className="eyebrow mb-1">Samstag und Sonntag</dt>
                <dd>
                  <span className="whitespace-nowrap">17:30–19:30 Uhr</span> oder{' '}
                  <span className="whitespace-nowrap">19:30–21:30 Uhr</span>
                </dd>
              </div>
            </dl>

            <a href="#buchen" onClick={trackBookClick} className="btn-gold mt-10 px-10">
              Termin wählen
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
