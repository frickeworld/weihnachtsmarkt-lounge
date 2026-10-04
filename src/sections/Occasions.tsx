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
        <ul className="grid gap-5 md:grid-cols-3">
          {occasions.map((o, i) => {
            const Icon = icons[o.key];
            return (
              <Reveal as="li" key={o.key} delay={i * 0.08} className="card card-hover p-8">
                <Icon className="mb-5 h-10 w-10 text-gold-deep" />
                <h3 className="mb-3 text-2xl font-medium">{o.title}</h3>
                <p className="leading-relaxed text-ink-soft">{o.text}</p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
