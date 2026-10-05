import { IconChevron } from '@/components/Icons';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { talerLevels } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import type { ReactNode } from 'react';

export function Faq() {
  const s = useSettings();
  const { maxPersons, contactEmail } = s;
  const levels = talerLevels(s);
  const levelText =
    levels.length > 1
      ? `${levels.slice(0, -1).join(', ')} oder ${levels.at(-1)}`
      : String(levels[0]);
  const items: { q: string; a: ReactNode }[] = [
    {
      q: 'Wie funktionieren die Residenztaler?',
      a: `Beim Einlass erhältst du je nach Zeitfenster ${levelText} Residenztaler im Wert von je 1 €. Du kannst sie an den Ständen des Weihnachtsmarkts im Schlosspark einlösen – pro gekauftem Artikel einen Taler.`,
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
          Die Lounge bietet Platz für bis zu {maxPersons} Personen. Für größere Gruppen reservieren
          wir gern mehrere Zeitfenster hintereinander oder an verschiedenen Tagen – nutze dafür die{' '}
          <a href="#firmen" className="font-semibold text-gold-deep underline underline-offset-4">
            Anfrage für Firmen und Gruppen
          </a>{' '}
          oder schreib an{' '}
          <a
            href={`mailto:${contactEmail}`}
            className="font-semibold text-gold-deep underline underline-offset-4"
          >
            {contactEmail}
          </a>
          .
        </>
      ),
    },
    {
      q: 'Ich habe kein Ticket bekommen. Was nun?',
      a: (
        <>
          Schau bitte zuerst im Spam-Ordner nach. Ist es dort auch nicht, schreib uns über das{' '}
          <a href="#kontakt" className="font-semibold text-gold-deep underline underline-offset-4">
            Kontaktformular
          </a>{' '}
          – am besten mit deinem Buchungscode. STUDIO/F schickt dir das Ticket erneut.
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
      a: 'Mitten auf dem Weihnachtsmarkt im Schlosspark in Detmold.',
    },
  ];

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Häufige Fragen" />
        <Reveal className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
          {items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-lg font-semibold transition-colors hover:text-gold-deep sm:px-6 [&::-webkit-details-marker]:hidden">
                {item.q}
                <IconChevron className="h-5 w-5 shrink-0 text-gold-deep transition-transform duration-300 group-open:rotate-90" />
              </summary>
              <div className="px-5 pb-5 leading-relaxed text-ink-soft sm:px-6">{item.a}</div>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
