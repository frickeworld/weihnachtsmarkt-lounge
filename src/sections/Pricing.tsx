import { IconCheck } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { formatCents } from '@/lib/money';
import { useSettings } from '@/lib/settingsContext';
import { trackBookClick } from '@/lib/track';

export function Pricing() {
  const s = useSettings();
  const included = [
    'Lounge exklusiv für 2 Stunden',
    `Platz für bis zu ${s.maxPersons} Personen`,
    `${s.talerCount} € Freiverzehr – ${s.talerCount} Residenztaler für die Stände`,
    'Tischservice der Tanzschule Fricke',
    'Ticket mit QR-Code per E-Mail',
  ];

  return (
    <section id="preis" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeading eyebrow="Preis und Zeiten" title="Ein Preis, alles drin" />
        <Reveal className="grid overflow-hidden rounded-[28px] shadow-[0_30px_60px_-40px_rgba(36,34,30,0.6)] md:grid-cols-[1fr_1.1fr]">
          <div className="glitter flex flex-col justify-center p-8 text-center sm:p-12">
            <p className="text-sm font-bold tracking-[0.2em] uppercase">
              Pro Lounge und Zeitfenster
            </p>
            <p className="font-display mt-3 text-7xl leading-none font-medium sm:text-8xl">
              {formatCents(s.priceCents).replace(/,00\s?€$/, ' €')}
            </p>
            <p className="mt-3 font-medium">zzgl. {formatCents(s.feeCents)} Vorverkaufsgebühr</p>
            <a href="#buchen" onClick={trackBookClick} className="btn-outline mt-8 self-center">
              Lounge buchen
            </a>
          </div>
          <div className="bg-surface p-8 sm:p-12">
            <h3 className="text-xl font-medium">Inklusive</h3>
            <ul className="mt-5 space-y-3">
              {included.map((item) => (
                <li key={item} className="flex gap-3">
                  <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="my-8 h-px bg-line" aria-hidden="true" />
            <dl className="grid gap-5 sm:grid-cols-2">
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}
