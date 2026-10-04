import { IconPin } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { LOCATION_ADDRESS, MAPS_URL } from '@/content/home';

export function Directions() {
  return (
    <section id="anfahrt" className="scroll-mt-20 bg-sand px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Anfahrt" title="So findest du uns" />
        <Reveal className="card p-8 text-center sm:p-10">
          <IconPin className="mx-auto mb-5 h-10 w-10 text-gold-deep" />
          <p className="text-lg leading-relaxed text-ink">
            Die Lounge steht mitten auf dem Weihnachtsmarkt im Schlosspark in Detmold.
          </p>
          <address className="mt-4 text-ink-soft not-italic">{LOCATION_ADDRESS}</address>
          <p className="mt-4 text-ink-soft">
            Die Innenstadt ist zu Fuß gut erreichbar. Parkhäuser findest du rund um die Altstadt.
          </p>
          <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="btn-outline mt-8">
            Route in Google Maps öffnen
          </a>
        </Reveal>
      </div>
    </section>
  );
}
