import hero1200Avif from '@/assets/hero-1200.avif';
import hero1200 from '@/assets/hero-1200.webp';
import hero800Avif from '@/assets/hero-800.avif';
import hero800 from '@/assets/hero-800.webp';
import { GlitterBand } from '@/components/GlitterBand';
import { Snowfall } from '@/components/Snowfall';
import { WeihnachtsmarktLogo } from '@/components/WeihnachtsmarktLogo';
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
        <picture className="contents">
          <source
            type="image/avif"
            srcSet={`${hero800Avif} 800w, ${hero1200Avif} 1200w`}
            sizes="100vw"
          />
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
        </picture>
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
              Überdacht, warm und gemütlich – für bis zu {s.maxPersons} Personen, mit Tischservice
              direkt an deinem Platz.
            </p>
            {/* Das stärkste Argument groß: Freiverzehr */}
            <div className="glitter mt-6 inline-flex items-center gap-4 rounded-2xl px-5 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]">
              <span className="font-display text-5xl leading-none font-medium sm:text-6xl">
                {s.talerCount}&nbsp;€
              </span>
              <span className="text-sm leading-tight font-bold tracking-wide uppercase">
                Freiverzehr
                <br />
                inklusive
              </span>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <a
                href="#buchen"
                onClick={trackBookClick}
                className="btn-gold w-full px-8 text-base sm:w-auto"
              >
                Lounge buchen
              </a>
              <a href="#erlebnis" className="btn-outline w-full sm:w-auto">
                Was dich erwartet
              </a>
            </div>
          </div>
        </div>
        <p className="absolute right-3 bottom-2 z-20 text-[11px] text-on-dark/60">
          Symbolbild · Bildquelle: Stadt Detmold
        </p>
      </div>
    </section>
  );
}
