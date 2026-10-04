import { useSettings } from '@/lib/settingsContext';
import { LEGAL_SHORT as L } from '../../../supabase/functions/_shared/legal.ts';
import { H2, LegalLayout } from './LegalLayout';

export function ImpressumPage() {
  const { contactEmail } = useSettings();
  return (
    <LegalLayout title="Impressum">
      <H2>Angaben gemäß § 5 DDG</H2>
      <p>
        {L.company}
        <br />
        {L.address}
      </p>
      <p>
        Vertreten durch die Geschäftsführung: {L.managingDirector}
        <br />
        Registereintrag: {L.register}
        <br />
        Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {L.vatId}
      </p>

      <H2>Kontakt</H2>
      <p>
        E-Mail: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        <br />
        Telefon: {L.phone}
      </p>

      <H2>Veranstaltung</H2>
      <p>
        Die Weihnachtsmarkt-Lounge ist eine Aktion von {L.partner} ({L.partnerAddress}). Verkauf,
        Zahlungsabwicklung und Rechnungsstellung erfolgen durch die {L.company}. Der technische
        Betrieb und die Betreuung der Buchungen liegen bei STUDIO/F, einer Marke der {L.company}.
      </p>

      <H2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</H2>
      <p>{L.contentResponsible}</p>

      <H2>Verbraucherstreitbeilegung</H2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen. [VON ANWALT PRÜFEN LASSEN]
      </p>

      <H2>Bildnachweise</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Foto im Kopfbereich: Stadt Detmold (Symbolbild) [NUTZUNGSRECHT KLÄREN]</li>
        <li>
          Gold-Glitzer-Textur und Schriftzug „Weihnachtsmarkt“: weihnachtsmarkt-detmold.de
          [NUTZUNGSRECHT KLÄREN]
        </li>
        <li>Logos der Sponsoren und Partner: jeweilige Rechteinhaber</li>
      </ul>

      <H2>Haftung für Links</H2>
      <p>
        Diese Website enthält Links zu externen Websites (z. B. Instagram, Google Maps,
        weihnachtsmarkt-detmold.de). Für deren Inhalte sind ausschließlich die jeweiligen Anbieter
        verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar.
      </p>
    </LegalLayout>
  );
}
