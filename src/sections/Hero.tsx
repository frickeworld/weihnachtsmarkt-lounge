import { LightString } from '@/components/LightString';
import { LogoPlaque } from '@/components/LogoPlaque';
import { useSettings } from '@/lib/settingsContext';
import { trackBookClick } from '@/lib/track';

/**
 * Hero. Solange kein Foto vorliegt, grafisch: Goldlicht, Bokeh-Lichter, Lichterkette.
 * Sobald ein Hero-Bild in /assets liegt, wird es hier als <picture> mit Vermerk „Symbolbild“ eingebunden.
 */
const bokeh = [
  { x: '8%', y: '30%', s: 140, o: 0.35, d: '0s' },
  { x: '86%', y: '22%', s: 180, o: 0.3, d: '2s' },
  { x: '72%', y: '70%', s: 120, o: 0.28, d: '4s' },
  { x: '18%', y: '78%', s: 160, o: 0.25, d: '1s' },
  { x: '50%', y: '12%', s: 220, o: 0.18, d: '3s' },
  { x: '94%', y: '58%', s: 90, o: 0.3, d: '5s' },
  { x: '3%', y: '58%', s: 80, o: 0.28, d: '2.5s' },
];

export function Hero() {
  const { talerCount, maxPersons } = useSettings();
  return (
    <section
      id="start"
      className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* Hintergrund */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_38%,#3b2a12_0%,#1b140d_45%,#0f0d0b_80%)]" />
        {bokeh.map((b, i) => (
          <span
            key={i}
            className="glow-pulse absolute rounded-full"
            style={{
              left: b.x,
              top: b.y,
              width: b.s,
              height: b.s,
              opacity: b.o,
              animationDelay: b.d,
              transform: 'translate(-50%, -50%)',
              background:
                'radial-gradient(circle, rgba(255,214,140,0.9) 0%, rgba(201,162,77,0.35) 40%, transparent 70%)',
              filter: 'blur(6px)',
            }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night to-transparent" />
      </div>

      <LightString variant="hero" />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pt-4 pb-16 text-center sm:px-6">
        <p className="eyebrow mb-6">Weihnachtsmarkt im Schlosspark Detmold</p>
        <LogoPlaque size="lg" />
        <div
          className="mt-8 mb-7 h-px w-28 bg-gradient-to-r from-transparent via-gold to-transparent"
          aria-hidden="true"
        />
        <h1
          id="hero-title"
          className="gold-shimmer-text max-w-3xl text-[2.6rem] leading-[1.08] font-semibold sm:text-6xl lg:text-7xl"
        >
          Deine Lounge mitten im Weihnachtsmarkt
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/85 sm:text-xl">
          Überdacht, warm und gemütlich – für bis zu {maxPersons} Personen. Mit {talerCount} €
          Freiverzehr und Tischservice direkt an deinem Platz.
        </p>
        <div className="mt-9 flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
          <a href="#buchen" onClick={trackBookClick} className="btn-gold px-8 text-base">
            Jetzt Lounge buchen
          </a>
          <a
            href="#erlebnis"
            className="text-champagne underline decoration-gold/50 underline-offset-[6px] transition-colors hover:text-cream hover:decoration-champagne"
          >
            Was dich erwartet
          </a>
        </div>
      </div>
    </section>
  );
}
