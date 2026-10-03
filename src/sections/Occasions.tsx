import { IconBriefcase, IconGlasses, IconHome } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { occasions } from '@/content/home';

const icons = { firma: IconBriefcase, familie: IconHome, freunde: IconGlasses } as const;

export function Occasions() {
  return (
    <section id="anlaesse" className="scroll-mt-20 bg-coal/50 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Perfekt für" />
        <ul className="grid gap-5 md:grid-cols-3">
          {occasions.map((o, i) => {
            const Icon = icons[o.key];
            return (
              <Reveal
                as="li"
                key={o.key}
                delay={i * 0.08}
                className="card card-hover relative overflow-hidden p-8 text-center"
              >
                <div
                  aria-hidden="true"
                  className="absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-gold/15 blur-2xl"
                />
                <Icon className="relative mx-auto mb-5 h-11 w-11 text-gold" />
                <h3 className="relative mb-3 text-3xl font-semibold">{o.title}</h3>
                <p className="relative leading-relaxed text-cream/75">{o.text}</p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
