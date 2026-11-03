import { useSettings } from '@/lib/settingsContext';
import { LEGAL_SHORT as L } from '../../../supabase/functions/_shared/legal.ts';
import { H2, LegalLayout } from './LegalLayout';

export function ImpressumPage() {
  const { contactEmail } = useSettings();
  return (
    <LegalLayout title="Impressum">
      <H2>Angaben gemäß § 5 DDG</H2>
      <p>
        Anbieter dieser Buchungsseite, Verkäufer der Lounge-Buchungen, Zahlungsempfänger und
        Rechnungssteller:
      </p>
      <p>
        {L.company}
        <br />
        {L.address}
      </p>
      <p>
        Vertreten durch den Geschäftsführer: {L.managingDirector}
        <br />
        Registereintrag: {L.register}
        <br />
        Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {L.vatId}
      </p>
      <p>
        Telefon: {L.phone}
        <br />
        E-Mail: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
      <p>Technischer Betrieb und Betreuung der Buchungen: STUDIO/F, eine Marke der {L.company}.</p>

      <H2>Gastgeber und Veranstalter der Lounge</H2>
      <p>
        Werbegemeinschaft Detmold e. V. („Die Händler“)
        <br />
        {L.partnerAddress}
      </p>
      <p>
        Vertreten durch den Vorstand: {L.partnerBoard}
        <br />
        Registereintrag: {L.partnerRegister}
      </p>
      <p>
        Telefon: {L.partnerPhone}
        <br />
        E-Mail: <a href={`mailto:${L.partnerEmail}`}>{L.partnerEmail}</a>
      </p>
      <p>
        Die Weihnachtsmarkt-Lounge ist eine Aktion der Werbegemeinschaft Detmold e. V. auf dem
        Weihnachtsmarkt im Schlosspark Detmold. Verkauf, Zahlungsabwicklung und Rechnungsstellung
        erfolgen durch die {L.company}. Fragen zu Buchungen beantwortet STUDIO/F.
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
