import { useSettings } from '@/lib/settingsContext';
import { LEGAL_SHORT as L } from '../../../supabase/functions/_shared/legal.ts';
import { H2, H3, LegalLayout } from './LegalLayout';

export function DatenschutzPage() {
  const { contactEmail } = useSettings();
  return (
    <LegalLayout title="Datenschutzerklärung">
      <H2>1. Verantwortlicher</H2>
      <p>
        {L.company}, {L.address}, E-Mail: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        STUDIO/F ist eine Marke der {L.company}. [DATENSCHUTZBEAUFTRAGTER, FALLS VORHANDEN]
      </p>

      <H2>2. Überblick</H2>
      <p>
        Wir verarbeiten personenbezogene Daten nur, soweit das für die Buchung der Lounge, die
        Durchführung vor Ort, die Abrechnung und deine Anfragen nötig ist. Wir setzen keine Cookies
        für Werbung oder Analyse ein und binden keine Werbe- oder Tracking-Dienste ein. Schriftarten
        werden von unserem eigenen Server geladen.
      </p>

      <H2>3. Aufruf der Website</H2>
      <p>
        Beim Aufruf verarbeitet unser Hosting-Anbieter [HOSTING: Mittwald CM Service GmbH & Co. KG,
        Espelkamp] technisch notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser) in
        Server-Logdateien, um die Website sicher auszuliefern (Art. 6 Abs. 1 lit. f DSGVO).
        [SPEICHERDAUER DER LOGS]
      </p>
      <H3>Reichweitenmessung ohne Cookies</H3>
      <p>
        Wir zählen Seitenaufrufe und Klicks auf „Lounge buchen“ zusammen mit der Angabe „Handy“ oder
        „Computer“. Dabei speichern wir keine IP-Adresse, keine Kennung und setzen keine Cookies;
        ein Rückschluss auf dich ist nicht möglich.
      </p>

      <H2>4. Buchung</H2>
      <p>
        Für die Buchung verarbeiten wir Name, E-Mail, Telefon, Personenzahl, Termin, optional
        Anlass, Firmenname, Rechnungsadresse, USt-ID und Wünsche (Art. 6 Abs. 1 lit. b DSGVO,
        Vertrag). Die Daten liegen in unserer Datenbank bei Supabase (Supabase Inc., Rechenzentrum
        in Frankfurt am Main, Auftragsverarbeitung; Übermittlung in die USA möglich, abgesichert
        über EU-Standardvertragsklauseln [PRÜFEN]).
      </p>
      <H3>Zahlung über Stripe</H3>
      <p>
        Die Zahlung wickelt Stripe Payments Europe Ltd. (Dublin, Irland) ab. Dafür übermitteln wir
        Name, E-Mail, Betrag und ggf. Rechnungsangaben. Zahlungsdaten (z. B. Kartennummer) gibst du
        direkt bei Stripe ein; wir erhalten sie nicht. Rechnungen erstellt Stripe in unserem
        Auftrag.
      </p>
      <H3>Ticket und E-Mails über Brevo</H3>
      <p>
        Ticket, Erinnerung am Buchungstag und ggf. Rechnungslinks versenden wir über Brevo
        (Sendinblue GmbH, Berlin [FIRMIERUNG PRÜFEN], Auftragsverarbeitung). Alle Bucherinnen und
        Bucher werden in der Liste „Lounge-Buchungen“ geführt – sie dient nur der Abwicklung, nicht
        der Werbung.
      </p>
      <H3>Weitergabe an Veranstaltungspartner</H3>
      <p>
        Zur Durchführung und Abrechnung sehen {L.partner} Name, Firma, Personenzahl, Anlass, Termin
        und Einlass-Status – keine E-Mail-Adresse, Telefonnummer, Anschrift oder Wünsche. Das Team
        der Tanzschule Fricke erhält für den Tischservice eine Tagesliste mit Namen, Telefonnummer,
        Personenzahl und Wünschen (Art. 6 Abs. 1 lit. b und f DSGVO).
      </p>
      <H3>Einlass</H3>
      <p>
        Am Einlass wird der QR-Code bzw. Buchungscode geprüft. Wir speichern, wann eingecheckt und
        die Residenztaler ausgegeben wurden. Für den Schutz der Scanner-Anmeldung speichern wir nur
        einen nicht rückrechenbaren Hash der IP-Adresse für kurze Zeit.
      </p>
      <H3>Wallet</H3>
      <p>
        Wenn du dein Ticket in Apple Wallet oder Google Wallet speicherst, wird die Ticketdatei auf
        deinem Gerät abgelegt. Bei Google Wallet übermitteln wir dazu Termin, Buchungscode,
        Personenzahl und den QR-Inhalt – keinen Namen und keine Kontaktdaten – an Google (Google
        Ireland Ltd.). Das geschieht nur, wenn du den Button nutzt.
      </p>

      <H2>5. Newsletter (freiwillig)</H2>
      <p>
        Nur wenn du beim Buchen das Häkchen setzt und die Anmeldung per E-Mail bestätigst
        (Double-Opt-in), erhältst du den STUDIO/F-Newsletter (Art. 6 Abs. 1 lit. a DSGVO). Du kannst
        dich jederzeit über den Link in jeder Ausgabe abmelden.
      </p>

      <H2>6. Kontaktformular</H2>
      <p>
        Nachrichten aus dem Kontaktformular senden wir per E-Mail (über Brevo) an unser Postfach und
        speichern sie nicht in der Datenbank. Wir nutzen deine Angaben nur zur Beantwortung (Art. 6
        Abs. 1 lit. b bzw. f DSGVO). Zum Schutz vor Missbrauch zählen wir Anfragen je Gerät über
        einen Hash der IP-Adresse, der nach kurzer Zeit gelöscht wird.
      </p>

      <H2>7. Anmeldebereich für Partner</H2>
      <p>
        Für Mitarbeitende und Partner gibt es einen Anmeldebereich. Die Anmeldung wird technisch
        notwendig im Speicher des Browsers abgelegt (§ 25 Abs. 2 TDDDG).
      </p>

      <H2>8. Speicherdauer</H2>
      <p>
        Kontaktdaten aus Buchungen anonymisieren wir nach der Saison, spätestens zum 31. März des
        Folgejahres. Beträge und Statistik bleiben ohne Personenbezug erhalten. Rechnungs- und
        Buchhaltungsdaten bewahren wir nach den gesetzlichen Fristen (bis zu 10 Jahre) auf.
      </p>

      <H2>9. Deine Rechte</H2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter
        Interessen sowie das Recht, eine Einwilligung jederzeit zu widerrufen. Schreib uns dazu an{' '}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. Außerdem kannst du dich bei einer
        Aufsichtsbehörde beschweren, z. B. bei der {L.supervisoryAuthority}.
      </p>

      <H2>10. Externe Links</H2>
      <p>
        Links zu Google Maps, Instagram oder anderen Seiten öffnen erst beim Anklicken die Seite des
        jeweiligen Anbieters; vorher werden keine Daten übertragen.
      </p>
    </LegalLayout>
  );
}
