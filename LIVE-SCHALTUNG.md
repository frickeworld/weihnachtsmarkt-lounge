# Live-Schaltung – Checkliste

Reihenfolge von oben nach unten abarbeiten. Details zu jedem Schritt stehen in
`docs/SETUP.md` (Abschnittsnummern in Klammern). Erst wenn **alle** Punkte abgehakt sind,
geht die Seite unter der echten Domain online.

## A. Inhalte und Recht (Louis / Anwalt / Steuerberater)

- [ ] **Impressum, Datenschutz, AGB** vom Anwalt prüfen lassen; alle `[PLATZHALTER]` füllen
      (Adresse, Registergericht, HRB, Geschäftsführung, USt-ID, Telefon, Verantwortlicher nach
      § 18 MStV, Gültigkeit der Residenztaler, Haftung, Streitbeilegung). Danach den Vermerk
      „Entwurf – noch nicht freigegeben“ entfernen (`src/pages/legal/LegalLayout.tsx`) und
      Stand-Datum setzen (`supabase/functions/_shared/legal.ts`).
- [ ] **Preisstaffel** (99/149/199 € Endpreise inkl. 3,50 € Gebühr, „ab 99 €“) vom Anwalt
      prüfen lassen (PAngV: „ab“-Preis, Gesamtpreis je Zeitfenster vor der Buchung).
- [ ] **Sonderveranstaltungen** (Partys 22./23./29./30., Weidmüller/Stegelmann) im Admin-Kalender
      mit Titel, Preis und Freiverzehr anlegen, bevor die ersten Buchungen eingehen.
- [ ] **Umsatzsteuer**: Ausweis von Lounge-Preis, Gebühr und Residenztalern mit dem
      Steuerberater klären (Stripe-Rechnungen, AGB § 3).
- [ ] **Bildrechte**: Foto Stadt Detmold, Gold-Glitzer-Textur und Markt-Schriftzug von
      weihnachtsmarkt-detmold.de – schriftliche Erlaubnis oder ersetzen. Sponsorenliste
      bestätigen lassen. Freigabe des weißen Händler-Logos durch die Werbegemeinschaft.
- [ ] **Du-Ansprache** mit der Werbegemeinschaft abstimmen.
- [ ] **Lounge-Fotos** in `assets/lounge-fotos/` (SETUP 13), Bildbeschreibungen eintragen.
- [ ] Koordinaten der Lounge für die Wallet-Anzeige prüfen (`LOUNGE_COORDINATES` in
      `supabase/functions/_shared/walletConfig.ts`).

## B. Konten und Zugangsdaten

- [ ] **Stripe auf Live** (SETUP 6): Live-Schlüssel als Supabase-Secret `STRIPE_SECRET_KEY`,
      neuen Live-Webhook anlegen (gleiche Ereignisse) und `STRIPE_WEBHOOK_SECRET` ersetzen.
      PayPal, Apple Pay und Google Pay im Live-Konto aktiv; Apple-Pay-Domain verifizieren.
      Rechnungs-Mails in Stripe einschalten (SETUP 9).
- [ ] **Brevo** (SETUP 7): Absender-Domain mit SPF/DKIM/DMARC verifiziert, Listen-IDs und
      Double-Opt-in-Vorlage geprüft. SMTP für Auth-Mails eingetragen (SETUP 10.1).
- [ ] **Supabase-Secrets** vollständig (SETUP 5, 8, 11, 12): u. a. `PUBLIC_SITE_URL` = echte
      Domain, `CRON_SECRET`, `SCANNER_TOKEN_SECRET`, Brevo, Stripe, ggf. Wallet.
- [ ] **Supabase Auth** (SETUP 4): Site URL und Redirect URLs auf die echte Domain;
      Registrierung aus, E-Mail-Anbieter an, TOTP an. Deutsche Auth-Mails (SETUP 10.2).
- [ ] **Wallet** (optional, SETUP 11): Apple-Zertifikat und Google-Konto; offizielle
      Wallet-Badges statt der schwarzen Platzhalter-Buttons einbauen.

## C. Daten und Einstellungen

- [ ] Im Admin unter **Einstellungen**: Saison, Preisstaffel je Zeitfenster, Buchungsschluss,
      Kontakt-E-Mail, Treffpunkt. Zeitfenster pro Wochentag prüfen.
- [ ] Im **Kalender** Schließtage und gesperrte Zeitfenster eintragen.
- [ ] **Zugänge**: Admins mit 2FA, Händler-Zugänge einladen (E-Mail-Adressen von den Händlern).
- [ ] **Scanner-PIN** setzen, Einlass-Team einweisen (`/scan`, Taschenlampe, Offline-Modus).
- [ ] **Testdaten löschen**: `scripts/testdaten-zuruecksetzen.sql` im SQL Editor ausführen
      (nur vor Saisonstart möglich) und den Storage-Bucket „tickets“ leeren.

## D. Technik

- [ ] Branch `main` = live: Pull Request vom Arbeits-Branch nach `main` mergen. Die GitHub
      Action spielt Migrationen und Edge Functions ein (`deploy-supabase.yml`).
- [ ] **Live-Build** erzeugen (auf dem eigenen Rechner oder in der CI):
      `bash
VITE_SUPABASE_URL=https://<projekt>.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon-key> \
VITE_PUBLIC_SITE_URL=https://<domain> \
VITE_NOINDEX=false \
npm run build
`
      `VITE_NOINDEX=false` nur für die echte Domain – sonst bleibt die Seite für Suchmaschinen
      gesperrt.
- [ ] Inhalt von `dist/` per SFTP zu **Mittwald** hochladen (inkl. der versteckten Datei
      `.htaccess`: SPA-Weiterleitung, HTTPS, Sicherheits-Header, Caching). SSL-Zertifikat für
      die Domain in Mittwald aktivieren.
- [ ] Prüfen: `https://<domain>/robots.txt` erlaubt die Startseite und sperrt `/admin`,
      `/haendler`, `/scan`, `/ticket`, `/buchung`, `/newsletter`, `/login`;
      `https://<domain>/sitemap.xml` ist erreichbar.
- [ ] Cloudflare-Vorschau bleibt bestehen (immer `noindex`), aber nicht öffentlich verlinken.

## E. Abnahme auf der echten Domain

- [ ] **Echte Buchung** mit eigener Karte (oder PayPal) → Ticket-Mail mit PDF, Wallet-Buttons,
      Erinnerung am Buchungstag. Danach im Stripe-Dashboard **erstatten** und im Admin
      **stornieren**.
- [ ] Buchung mit Firmenname → Rechnung von Stripe kommt per Mail.
- [ ] Newsletter-Häkchen → Double-Opt-in-Mail, Bestätigungsseite.
- [ ] Kontaktformular → Mail kommt bei info@studio-f.club an, „Antworten“ geht an den Absender.
- [ ] Scanner am Handy vor Ort: grün, gelb, orange, rot, Taler, Flugmodus-Test, Netzempfang
      am Lounge-Standort.
- [ ] Händler-Zugang: Übersicht, Buchungen, Abrechnung (PDF/CSV).
- [ ] Lighthouse mobil ≥ 85 (Performance, Barrierefreiheit, Best Practices, SEO).
- [ ] Rich-Results-Test von Google für die Startseite (Produkt mit Preisspanne 99–199 €).

## F. Nach der Saison

- [ ] Abrechnung für die Händler erstellen (Admin → Abrechnung → PDF).
- [ ] **Ab 31. März**: Admin → Datenpflege → Kundendaten anonymisieren.
