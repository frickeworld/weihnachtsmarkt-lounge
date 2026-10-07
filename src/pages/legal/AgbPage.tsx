import { formatCents } from '@/lib/money';
import { priceGroups } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { LEGAL_SHORT as L } from '../../../supabase/functions/_shared/legal.ts';
import { H2, LegalLayout } from './LegalLayout';

export function AgbPage() {
  const s = useSettings();
  const n = (i: number) => <span className="font-semibold">§ {i}</span>;
  return (
    <LegalLayout title="Allgemeine Geschäftsbedingungen">
      <p>für die Buchung der Weihnachtsmarkt-Lounge der Händler im Schlosspark Detmold</p>

      <H2>{n(1)} Geltungsbereich und Vertragspartner</H2>
      <p>
        Diese AGB gelten für alle Buchungen der Weihnachtsmarkt-Lounge über diese Website.
        Vertragspartner ist die {L.company}, {L.address} („wir“). Die Lounge ist eine Aktion von{' '}
        {L.partner}.
      </p>

      <H2>{n(2)} Leistungen</H2>
      <p>Mit einer Buchung erhältst du für das gewählte Zeitfenster:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>die exklusive Nutzung der überdachten Lounge für 2 Stunden,</li>
        <li>Platz für bis zu {s.maxPersons} Personen,</li>
        <li>
          Residenztaler im Wert von je 1 € als Freiverzehr – die Anzahl hängt vom gebuchten
          Zeitfenster ab (siehe § 3) – zur Einlösung an den Ständen des Weihnachtsmarkts im
          Schlosspark, pro gekauftem Artikel ein Taler,
        </li>
        <li>Tischservice durch die Tanzschule Fricke.</li>
      </ul>
      <p>
        Speisen und Getränke über den Wert der Residenztaler hinaus sind nicht enthalten. Die
        Residenztaler werden nicht in Bargeld ausgezahlt und gelten [GÜLTIGKEIT DER TALER FESTLEGEN,
        z. B. nur am Buchungstag].
      </p>

      <H2>{n(3)} Preise</H2>
      <p>
        Preis und Freiverzehr hängen vom Wochentag und Zeitfenster ab. Alle Preise sind Endpreise je
        Lounge und enthalten eine Vorverkaufsgebühr von {formatCents(s.feeCents)}. [ANGABE ZUR
        UMSATZSTEUER PRÜFEN: „inkl. gesetzlicher MwSt.“]
      </p>
      <ul className="list-disc space-y-1 pl-6">
        {priceGroups(s.priceList).flatMap((g) =>
          g.rows.map((r) => (
            <li key={g.days + r.label + r.totalCents}>
              {g.days}, {r.label} ({r.times.join(' oder ')} Uhr): {formatCents(r.totalCents)} inkl.{' '}
              {r.talerCount} € Freiverzehr
            </li>
          )),
        )}
      </ul>
      <p>
        Für Sonderveranstaltungen (z. B. Partys oder Live-Auftritte) können abweichende Preise und
        ein abweichender Freiverzehr gelten; sie werden vor der Buchung beim jeweiligen Termin
        angezeigt. Maßgeblich ist der bei der Buchung angezeigte Gesamtpreis.
      </p>
      <p>
        Persönliche Codes aus unserem Gewinnspiel werden bei der Buchung eingegeben und gelten nach
        den dort genannten Bedingungen (z. B. nur montags bis donnerstags, einmal einlösbar, nicht
        für Sonderveranstaltungen). Der Freiverzehr bleibt dabei in voller Höhe enthalten. Andere
        Rabatte gewähren wir nicht.
      </p>

      <H2>{n(4)} Vertragsschluss</H2>
      <p>
        Die Darstellung der freien Zeitfenster ist noch kein verbindliches Angebot. Mit Klick auf
        „Zahlungspflichtig buchen“ gibst du ein verbindliches Angebot ab. Während der Zahlung ist
        das Zeitfenster kurzzeitig für dich reserviert. Der Vertrag kommt mit erfolgreicher Zahlung
        zustande; du erhältst eine Bestätigung mit Ticket per E-Mail. Online-Buchungen sind bis{' '}
        {s.bookingCutoffMinutes} Minuten vor Beginn des Zeitfensters möglich.
      </p>

      <H2>{n(5)} Zahlung</H2>
      <p>
        Die Zahlung erfolgt im Voraus über unseren Zahlungsdienstleister Stripe per Karte, Apple
        Pay, Google Pay oder PayPal. Auf Wunsch (oder bei Angabe eines Firmennamens) erhältst du
        eine Rechnung per E-Mail.
      </p>

      <H2>{n(6)} Kein Widerrufsrecht, keine Stornierung</H2>
      <p>
        Die Buchung ist eine Dienstleistung im Zusammenhang mit Freizeitbetätigungen zu einem festen
        Termin. Ein Widerrufsrecht besteht daher nach § 312g Abs. 2 Nr. 9 BGB nicht. Eine
        Stornierung durch dich ist ausgeschlossen; der Preis wird auch fällig, wenn du die Lounge
        nicht nutzt.
      </p>

      <H2>{n(7)} Übertragung des Tickets</H2>
      <p>
        Das Ticket ist übertragbar. Wer den QR-Code oder den Buchungscode vorzeigt, erhält Einlass;
        eine Namensprüfung findet nicht statt. Jedes Ticket kann nur einmal eingelöst werden. Bitte
        gib dein Ticket nur an Personen weiter, denen du die Nutzung überlassen möchtest.
      </p>

      <H2>{n(8)} Ablauf vor Ort</H2>
      <p>
        Bitte sei pünktlich. Das Zeitfenster endet zur gebuchten Uhrzeit, auch wenn du später
        kommst. Die Höchstzahl von {s.maxPersons} Personen darf nicht überschritten werden. Den
        Anweisungen des Personals ist Folge zu leisten; bei groben Verstößen kann die Nutzung ohne
        Erstattung beendet werden. Für Jugendschutz und Alkoholausschank gelten die gesetzlichen
        Bestimmungen.
      </p>

      <H2>{n(9)} Absage durch uns</H2>
      <p>
        Müssen wir die Lounge absagen (z. B. wegen behördlicher Anordnung, Unwetter oder Ausfall des
        Weihnachtsmarkts), erstatten wir den gezahlten Betrag vollständig. Weitergehende Ansprüche
        bestehen nur nach § 10.
      </p>

      <H2>{n(10)} Haftung</H2>
      <p>
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von
        Leben, Körper oder Gesundheit. Bei leichter Fahrlässigkeit haften wir nur bei Verletzung
        wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, typischen Schaden. Für
        mitgebrachte Gegenstände wird keine Haftung übernommen. [VON ANWALT PRÜFEN LASSEN]
      </p>

      <H2>{n(11)} Datenschutz</H2>
      <p>
        Informationen zur Verarbeitung deiner Daten findest du in der{' '}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>

      <H2>{n(12)} Schlussbestimmungen</H2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese
        Rechtswahl nur, soweit dadurch nicht zwingende Schutzvorschriften des Staates ihres
        gewöhnlichen Aufenthalts entzogen werden. Sollte eine Bestimmung unwirksam sein, bleibt der
        Vertrag im Übrigen wirksam.
      </p>
    </LegalLayout>
  );
}
