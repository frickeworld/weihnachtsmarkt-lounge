import { IconChevron } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { PLACEHOLDER_POSITION } from '@/content/home';
import { useSettings } from '@/lib/settingsContext';
import type { ReactNode } from 'react';

export function Faq() {
  const { talerCount, maxPersons, contactEmail } = useSettings();
  const items: { q: string; a: ReactNode }[] = [
    {
      q: 'Wie funktionieren die Residenztaler?',
      a: `Beim Einlass erhältst du ${talerCount} Residenztaler im Wert von je 1 €. Du kannst sie an den Ständen des Weihnachtsmarkts im Schlosspark einlösen – pro gekauftem Artikel einen Taler.`,
    },
    {
      q: 'Kann ich meine Buchung stornieren?',
      a: 'Nein, Buchungen sind verbindlich. Wenn du nicht kannst, gib dein Ticket einfach weiter.',
    },
    {
      q: 'Was passiert bei Regen oder Schnee?',
      a: 'Nichts – die Lounge ist überdacht. Du sitzt trocken und warm.',
    },
    {
      q: `Wir sind mehr als ${maxPersons} Personen. Geht das?`,
      a: (
        <>
          Die Lounge bietet Platz für bis zu {maxPersons} Personen. Für größere Gruppen schreib uns
          an{' '}
          <a
            href={`mailto:${contactEmail}`}
            className="text-champagne underline underline-offset-4"
          >
            {contactEmail}
          </a>
          .
        </>
      ),
    },
    {
      q: 'Bekomme ich eine Rechnung?',
      a: 'Ja. Gib beim Buchen deinen Firmennamen an oder setze das Häkchen „Ich benötige eine Rechnung“. Die Rechnung kommt automatisch per E-Mail.',
    },
    {
      q: 'Wie bekomme ich Getränke?',
      a: 'Der Tischservice der Tanzschule Fricke kommt an euren Tisch. Natürlich kannst du auch selbst an die Stände gehen.',
    },
    {
      q: 'Wo finde ich die Lounge?',
      a: `Auf dem Weihnachtsmarkt im Schlosspark Detmold, direkt am Residenzschloss. ${PLACEHOLDER_POSITION}`,
    },
  ];

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading title="Häufige Fragen" />
        <Reveal className="divide-y divide-gold/20 border-y border-gold/20">
          {items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-lg font-semibold transition-colors hover:text-champagne [&::-webkit-details-marker]:hidden">
                {item.q}
                <IconChevron className="h-5 w-5 shrink-0 text-gold transition-transform duration-300 group-open:rotate-90" />
              </summary>
              <div className="pb-5 leading-relaxed text-cream/80">{item.a}</div>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
