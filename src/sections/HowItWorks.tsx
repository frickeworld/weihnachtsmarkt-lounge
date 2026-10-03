import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { howItWorks } from '@/content/home';

export function HowItWorks() {
  return (
    <section id="ablauf" className="scroll-mt-20 bg-coal/50 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="So funktioniert's" />
        <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
          {/* Verbindende Goldlinie: mobil senkrecht, ab md waagerecht */}
          <div
            aria-hidden="true"
            className="absolute top-7 bottom-7 left-7 w-px bg-gradient-to-b from-gold/70 via-gold/40 to-gold/10 md:top-7 md:right-[12.5%] md:bottom-auto md:left-[12.5%] md:h-px md:w-auto md:bg-gradient-to-r"
          />
          {howItWorks.map((step, i) => (
            <Reveal
              as="li"
              key={step.title}
              delay={i * 0.1}
              className="relative flex gap-5 md:flex-col md:items-center md:text-center"
            >
              <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold bg-night font-display text-2xl font-semibold text-champagne shadow-[0_0_24px_-6px_rgba(201,162,77,0.7)]">
                {i + 1}
              </span>
              <div className="pt-2 md:pt-4">
                <h3 className="mb-1 text-2xl font-semibold">{step.title}</h3>
                <p className="leading-relaxed text-cream/75">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
