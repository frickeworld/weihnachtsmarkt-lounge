import { IconBriefcase, IconGlasses, IconHome } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { occasions } from '@/content/home';

const icons = { firma: IconBriefcase, familie: IconHome, freunde: IconGlasses } as const;

export function Occasions() {
  return (
    <section id="anlaesse" className="scroll-mt-20 bg-sand px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Anlässe" title="Perfekt für" />
        <ul className="grid gap-3 md:grid-cols-3 md:gap-5">
          {occasions.map((o, i) => {
            const Icon = icons[o.key];
            return (
              <Reveal
                as="li"
                key={o.key}
                delay={i * 0.08}
                className="card card-hover flex gap-4 p-4 md:block md:p-8"
              >
                <Icon className="h-8 w-8 shrink-0 text-gold-deep md:mb-5 md:h-10 md:w-10" />
                <div>
                  <h3 className="mb-1 text-lg font-medium md:mb-3 md:text-2xl">{o.title}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-soft md:text-base">{o.text}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
