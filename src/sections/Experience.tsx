import { IconCoin, IconHut, IconPeople, IconService } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { useSettings } from '@/lib/settingsContext';

export function Experience() {
  const { maxPersons, talerCount } = useSettings();
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
      title: `${talerCount} € Freiverzehr`,
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
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal as="li" key={c.title} delay={i * 0.08} className="card card-hover p-7">
              <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 text-gold-deep">
                <c.icon className="h-7 w-7" />
              </span>
              <h3 className="mb-2 text-xl font-medium">{c.title}</h3>
              <p className="leading-relaxed text-ink-soft">{c.text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
