import hero1200 from '@/assets/hero-1200.webp';
import hero800 from '@/assets/hero-800.webp';
import { GlitterBand } from '@/components/GlitterBand';
import { Snowfall } from '@/components/Snowfall';
import { WeihnachtsmarktLogo } from '@/components/WeihnachtsmarktLogo';
import { formatCents } from '@/lib/money';
import { totalCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { trackBookClick } from '@/lib/track';

/**
 * Hero: Gold-Glitzer-Band mit Markt-Schriftzug, darunter großes Foto mit Schnee.
 * Foto ist ein Platzhalter von weihnachtsmarkt-detmold.de (Bildquelle: Stadt Detmold).
 */
export function Hero() {
  const s = useSettings();
  return (
    <section id="start" aria-labelledby="hero-title">
      <GlitterBand className="py-5 sm:py-7">
        <div className="flex justify-center px-4">
          <WeihnachtsmarktLogo className="w-56 sm:w-72" />
        </div>
      </GlitterBand>

      <div className="on-dark relative isolate overflow-hidden bg-brown text-on-dark">
        <img
          src={hero1200}
          srcSet={`${hero800} 800w, ${hero1200} 1200w`}
          sizes="100vw"
          alt="Drei gut gelaunte Gäste mit Glühwein an einem Stand des Weihnachtsmarkts"
          width={1200}
          height={800}
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_30%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(20,19,17,0.15)_0%,rgba(20,19,17,0.55)_45%,rgba(20,19,17,0.92)_100%)] md:bg-[linear-gradient(90deg,rgba(20,19,17,0.92)_0%,rgba(20,19,17,0.7)_42%,rgba(20,19,17,0.1)_75%)]"
        />
        <Snowfall />

        <div className="relative z-20 mx-auto flex min-h-[78svh] max-w-6xl flex-col justify-end px-4 pt-40 pb-12 sm:px-6 md:min-h-[640px] md:justify-center md:pt-16">
          <div className="max-w-xl">
            <p className="eyebrow mb-4">Schlosspark Detmold · Dezember 2026</p>
            <h1 id="hero-title" className="text-[2.6rem] leading-[1.05] font-medium sm:text-6xl">
              Deine Lounge mitten im Weihnachtsmarkt
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-on-dark/90 sm:text-xl">
              Überdacht, warm und gemütlich – für bis zu {s.maxPersons} Personen. Mit {s.talerCount}{' '}
              € Freiverzehr und Tischservice direkt an deinem Platz.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#buchen" onClick={trackBookClick} className="btn-gold px-7 text-base">
                Jetzt Lounge buchen
              </a>
              <a href="#erlebnis" className="btn-outline">
                Was dich erwartet
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2 text-sm">
              {[
                `bis ${s.maxPersons} Personen`,
                '2 Stunden exklusiv',
                `${formatCents(totalCents(s))} pro Lounge`,
              ].map((fact) => (
                <li
                  key={fact}
                  className="rounded-full bg-on-dark/12 px-3 py-1.5 text-on-dark ring-1 ring-on-dark/25 backdrop-blur-sm"
                >
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="absolute right-3 bottom-2 z-20 text-[11px] text-on-dark/60">
          Symbolbild · Bildquelle: Stadt Detmold
        </p>
      </div>
    </section>
  );
}
