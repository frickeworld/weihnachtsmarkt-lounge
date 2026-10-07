import { Link } from 'react-router-dom';
import { useSettings } from '@/lib/settingsContext';
import { formatLongDate } from '@/lib/dates';
import { LEGAL_SHORT as L } from '../../../supabase/functions/_shared/legal.ts';
import { H2, LegalLayout } from './LegalLayout';

/** Teilnahmebedingungen Gewinnspiel – Entwurf, vor dem Start anwaltlich prüfen. */
export function GiveawayTermsPage() {
  const s = useSettings();
  return (
    <LegalLayout title="Teilnahmebedingungen Gewinnspiel">
      <p>„Jede Woche einen Abend in der Lounge gewinnen“</p>

      <H2>1. Veranstalter</H2>
      <p>
        Veranstalter ist {L.partner}, {L.partnerAddress}. Die technische Durchführung übernimmt
        STUDIO/F, {L.company}, {L.address}, im Auftrag des Veranstalters. Das Gewinnspiel steht in
        keiner Verbindung zu Instagram/Meta.
      </p>

      <H2>2. Teilnahme</H2>
      <p>
        Teilnehmen dürfen Personen ab 18 Jahren mit Wohnsitz in Deutschland. Ausgeschlossen sind
        Mitarbeitende des Veranstalters, von STUDIO/F und der Tanzschule Fricke sowie deren
        Angehörige. Die Teilnahme ist kostenlos und erfolgt über das Formular auf dieser Website und
        die Bestätigung per E-Mail. Jede Person kann sich nur einmal anmelden; mehrfache
        Anmeldungen, z. B. mit verschiedenen E-Mail-Adressen, führen zum Ausschluss.
      </p>
      <p>
        <strong>Mit der Teilnahme meldest du dich zum Newsletter an.</strong> Den Newsletter
        versenden die Händler und STUDIO/F über die Lounge, Aktionen und Veranstaltungen in Detmold.
        Du kannst dich jederzeit abmelden; die Abmeldung vom Gewinnspiel ist über den Link in jeder
        Gewinnspiel-Mail möglich. [ANWALT PRÜFEN: Kopplung Teilnahme/Newsletter]
      </p>

      <H2>3. Ablauf und Ziehung</H2>
      <p>
        Das Gewinnspiel läuft bis {s.seasonEnd ? formatLongDate(s.seasonEnd) : '[ENDDATUM]'}. In der
        Regel jeden Montag wird unter allen bestätigten Teilnehmenden, die noch nicht gewonnen
        haben, ein Gewinner per Zufall gezogen. Wer einmal angemeldet ist, nimmt an allen folgenden
        Ziehungen teil. Für jede Person, die über den persönlichen Einladungslink teilnimmt und ihre
        Teilnahme bestätigt, erhält die einladende Person ein zusätzliches Los.
      </p>

      <H2>4. Gewinn</H2>
      <p>
        Pro Ziehung wird ein Abend in der Weihnachtsmarkt-Lounge der Händler verlost: exklusive
        Nutzung für 2 Stunden für bis zu {s.maxPersons} Personen, Freiverzehr in Residenztalern
        gemäß dem gewählten Zeitfenster und Tischservice. Der Gewinner erhält per E-Mail einen
        persönlichen Code und wählt damit selbst einen freien Abend bis zum Saisonende; ausgenommen
        sind Sonderveranstaltungen. Ein Anspruch auf einen bestimmten Termin besteht nicht. Eine
        Barauszahlung oder Übertragung des Codes ist ausgeschlossen; das Ticket selbst ist
        übertragbar.
      </p>

      <H2>5. Code für alle anderen</H2>
      <p>
        Teilnehmende, die nicht gewonnen haben, erhalten nach jeder Ziehung einen persönlichen,
        einmal einlösbaren Code über einen Preisnachlass auf einen Abend von Montag bis Donnerstag
        (nicht für Sonderveranstaltungen), gültig bis zum Saisonende. Der Freiverzehr bleibt in
        voller Höhe enthalten. Der Code ist nicht mit anderen Aktionen kombinierbar.
      </p>

      <H2>6. Benachrichtigung</H2>
      <p>
        Gewinner werden per E-Mail benachrichtigt. Löst der Gewinner den Code bis zum Saisonende
        nicht ein, verfällt der Gewinn ersatzlos. Namen von Gewinnern veröffentlichen wir nur mit
        ausdrücklicher Zustimmung.
      </p>

      <H2>7. Datenschutz</H2>
      <p>
        Für die Teilnahme speichern wir Vor- und Nachname, E-Mail-Adresse, optional die Firma, den
        Zeitpunkt der Anmeldung und Bestätigung sowie die Einladungen über deinen Link. Details
        stehen in der <Link to="/datenschutz">Datenschutzerklärung</Link>. [ANWALT PRÜFEN:
        Verantwortlichkeit Händler e. V. / Auftragsverarbeitung STUDIO/F]
      </p>

      <H2>8. Sonstiges</H2>
      <p>
        Der Veranstalter kann das Gewinnspiel aus wichtigem Grund vorzeitig beenden oder ändern,
        etwa bei technischen Problemen oder Manipulationsverdacht. Der Rechtsweg ist ausgeschlossen.
      </p>
    </LegalLayout>
  );
}
