import { IconCoin, IconHut, IconPeople, IconService } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { maxTalerCount } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';

export function Experience() {
  const s = useSettings();
  const { maxPersons } = s;
  const cards = [
    {
      icon: IconPeople,
      title: `Bis zu ${maxPersons} Personen`,
      text: 'Platz für dein Team, deine Familie oder deine Freunde.',
    },
    {
      icon: IconHut,
      title: 'Überdacht und gemütlich',
      text: 'Holzhütte mit Fellen, Lichterketten und leiser Musik.',
    },
    {
      icon: IconCoin,
      title: `Bis zu ${maxTalerCount(s)} € Freiverzehr`,
      text: 'In Residenztalern, einlösbar an den Ständen des Weihnachtsmarkts.',
    },
    {
      icon: IconService,
      title: 'Tischservice',
      text: 'Die Tanzschule Fricke kommt an euren Tisch und fragt, was ihr trinken möchtet.',
    },
  ];

  return (
    <section id="erlebnis" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Das Erlebnis" title="Weihnachtsmarkt, wie er sein soll">
          <p>
            Glühweinduft, das beleuchtete Residenzschloss, Musik im Hintergrund – und du sitzt
            mittendrin. Trocken, warm, mit Fellen auf den Bänken und Lichterketten über dem Tisch.
            Kein Suchen nach einem freien Stehtisch, kein Gedränge: Die Lounge gehört zwei Stunden
            lang nur dir und deinen Leuten.
          </p>
        </SectionHeading>
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal
              as="li"
              key={c.title}
              delay={i * 0.08}
              className="card card-hover flex gap-4 p-4 sm:block sm:p-7"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-deep sm:mb-5 sm:h-12 sm:w-12">
                <c.icon className="h-6 w-6 sm:h-7 sm:w-7" />
              </span>
              <div>
                <h3 className="mb-1 text-lg font-medium sm:mb-2 sm:text-xl">{c.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-soft sm:text-base">{c.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
