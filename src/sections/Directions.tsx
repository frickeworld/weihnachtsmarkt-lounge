import { IconPin } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { MAPS_URL, PLACEHOLDER_POSITION } from '@/content/home';

export function Directions() {
  return (
    <section id="anfahrt" className="scroll-mt-20 bg-coal/50 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading title="Anfahrt" />
        <Reveal className="card p-8 text-center sm:p-10">
          <IconPin className="mx-auto mb-5 h-10 w-10 text-gold" />
          <p className="text-lg leading-relaxed text-cream/85">
            Die Lounge steht auf dem Weihnachtsmarkt im Schlosspark Detmold, direkt am
            Residenzschloss. {PLACEHOLDER_POSITION}
          </p>
          <address className="mt-4 text-cream/70 not-italic">Schloßplatz 1, 32756 Detmold</address>
          <p className="mt-4 text-cream/70">
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
