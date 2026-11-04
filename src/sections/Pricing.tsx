import { IconCheck } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { formatCents } from '@/lib/money';
import {
  feeLabel,
  feeNote,
  loungeCents,
  maxTalerCount,
  minLoungeCents,
  priceGroups,
} from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { trackBookClick } from '@/lib/track';

const euro = (cents: number) => formatCents(cents).replace(/,00\s?€$/, ' €');

/** Preisstaffel nach Wochentag und Tageszeit (Lounge-Preise, Verarbeitungsgebühr kommt dazu). */
export function Pricing() {
  const s = useSettings();
  const groups = priceGroups(s.priceList);
  const included = [
    'Lounge exklusiv für 2 Stunden',
    `Platz für bis zu ${s.maxPersons} Personen`,
    `Bis zu ${maxTalerCount(s)} € Freiverzehr in Residenztalern für die Stände`,
    'Tischservice der Tanzschule Fricke',
    'Ticket mit QR-Code per E-Mail',
  ];

  return (
    <section id="preis" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Preise und Zeiten"
          title={`Deine Lounge ab ${euro(minLoungeCents(s))}`}
        >
          Jeder Preis enthält Freiverzehr in Residenztalern – je später der Abend, desto mehr.
        </SectionHeading>
        <Reveal className="grid overflow-hidden rounded-[28px] shadow-[0_30px_60px_-40px_rgba(36,34,30,0.6)] md:grid-cols-[1fr_1.4fr]">
          <div className="glitter flex flex-col justify-center p-8 text-center sm:p-12">
            <p className="text-sm font-bold tracking-[0.2em] uppercase">
              Pro Lounge und Zeitfenster
            </p>
            <p className="mt-3 text-2xl font-medium">ab</p>
            <p className="font-display text-7xl leading-none font-medium sm:text-8xl">
              {euro(minLoungeCents(s))}
            </p>
            <p className="mt-3 font-medium">{feeNote(s)}</p>
            <ul className="mt-8 space-y-2 text-left text-sm">
              {included.map((item) => (
                <li key={item} className="flex gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a href="#buchen" onClick={trackBookClick} className="btn-outline mt-8 self-center">
              Lounge buchen
            </a>
          </div>
          <div className="bg-surface p-6 sm:p-10">
            <h3 className="text-xl font-medium">Preise je Zeitfenster</h3>
            <div className="mt-5 space-y-6">
              {groups.map((g) => (
                <div key={g.days}>
                  <p className="eyebrow mb-2">{g.days}</p>
                  <ul className="divide-y divide-line rounded-2xl border border-line">
                    {g.rows.map((r) => (
                      <li
                        key={r.label + r.totalCents}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold">{r.label}</p>
                          <p className="text-sm text-ink-soft">
                            {r.times.map((t, i) => (
                              <span key={t} className="whitespace-nowrap">
                                {i > 0 && ' oder '}
                                {t} Uhr
                              </span>
                            ))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-2xl font-medium whitespace-nowrap">
                            {euro(loungeCents(r.totalCents, s))}
                          </p>
                          <p className="text-xs whitespace-nowrap text-gold-deep">
                            inkl. {r.talerCount} € Freiverzehr
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Alle Preise zzgl. {feeLabel(s)} Verarbeitungsgebühr. Die Gebühr wird beim Bezahlen
              hinzugerechnet. An besonderen Abenden (z. B. Partys oder Live-Auftritte) gelten eigene
              Preise – du siehst sie bei der Auswahl im Kalender.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
