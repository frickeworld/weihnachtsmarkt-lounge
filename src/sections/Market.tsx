import { GlitterBand } from '@/components/GlitterBand';
import { Reveal } from '@/components/Reveal';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, MARKET_URL } from '@/content/partners';

const pillars = [
  {
    title: 'Genießen',
    text: 'Der Duft von Gewürzen, eine heiße Tasse und etwas Leckeres auf die Hand – mit deinen Residenztalern direkt an den Ständen.',
  },
  {
    title: 'Stöbern',
    text: 'Mit Ruhe durch die Hütten bummeln, Handgemachtes entdecken und sich zu einer Geschenkidee inspirieren lassen.',
  },
  {
    title: 'Zusammensein',
    text: 'Mit Freunden, der Familie oder nach Feierabend mit dem Team: endlich wieder zusammenkommen – und zwischendurch in eure Lounge zurück.',
  },
];

/** Der Weihnachtsmarkt rund um die Lounge (Inhalte angelehnt an weihnachtsmarkt-detmold.de). */
export function Market() {
  return (
    <section id="weihnachtsmarkt" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <Reveal>
          <p className="eyebrow mb-3">Am Residenzschloss · mitten in Detmold</p>
          <h2 className="text-4xl leading-tight font-medium sm:text-5xl">
            Unser liebster Treffpunkt im Winter
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">
            Wenn der Schlosspark leuchtet, wird aus „nur kurz vorbeischauen“ schnell ein ganzer
            Abend. Zwischen Hütten und historischer Schlosskulisse ist Platz für kleine
            Entdeckungen, gute Gespräche und eine Pause vom Dezembertrubel. Programm und Aussteller
            findest du auf der Seite des Weihnachtsmarkts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={MARKET_URL} target="_blank" rel="noopener" className="btn-outline">
              Zum Weihnachtsmarkt
            </a>
          </div>
        </Reveal>
        <ul className="grid gap-4">
          {pillars.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 0.08} className="card flex gap-5 p-6">
              <span aria-hidden="true" className="glitter h-12 w-1.5 shrink-0 rounded-full" />
              <div>
                <h3 className="text-xl font-medium">{p.title}</h3>
                <p className="mt-1 leading-relaxed text-ink-soft">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>

      <Reveal className="mx-auto mt-16 max-w-6xl">
        <GlitterBand soft stars={false} className="rounded-[28px] px-6 py-10 sm:px-12">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
            <div>
              <p className="text-sm font-bold tracking-[0.2em] uppercase">Neuigkeiten vom Markt</p>
              <p className="font-display mt-2 text-3xl font-medium sm:text-4xl">
                Folge den Händlern auf Instagram
              </p>
            </div>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brown px-6 font-semibold text-on-dark transition-transform hover:-translate-y-0.5"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-none stroke-current"
                strokeWidth={1.6}
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.8" className="fill-current" />
              </svg>
              {INSTAGRAM_HANDLE}
            </a>
          </div>
        </GlitterBand>
      </Reveal>
    </section>
  );
}
