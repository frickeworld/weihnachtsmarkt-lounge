# Live-Test: echte Buchung Schritt für Schritt

Erst durchgehen, wenn `main` existiert, die GitHub Action Migrationen und Functions eingespielt
hat und alle Secrets gesetzt sind (siehe `LIVE-SCHALTUNG.md` und `docs/SETUP.md`).
Dauer: etwa 45 Minuten. Am besten zu zweit (eine Person bucht, eine scannt).

## 0. Vorbereitung

- [ ] Im Admin (mit 2FA) unter **Einstellungen**: Saison, Kontakt-E-Mail, Treffpunkt prüfen.
- [ ] **Zeitfenster und Preise**: Mo–Do 16:45/19:00, Fr–Sa 15:30/17:45/20:00, So 14:30/16:45/19:00 aktiv, Preise 149/199 €.
- [ ] **Kalender**: einen Testtag wählen, der sonst nicht verkauft wird; Sonderpreise eintragen, falls schon bekannt.
- [ ] Scanner-PIN setzen und notieren (nicht per Chat verschicken).
- [ ] Tagesbericht-Empfänger und Instagram-Follower eintragen.

## 1. Website

- [ ] Startseite auf dem Handy öffnen: „ab 149 €“, Preisübersicht, Freiverzehr, Galerie/Bild, Kontakt, Impressum, Datenschutz, AGB erreichbar.
- [ ] Kalender: Preise je Zeitfenster sichtbar, Sondertermine mit rotem Schild.

## 2. Buchung mit echter Zahlung

- [ ] Zeitfenster am Testtag wählen, Formular mit **Firmenname** (dann kommt eine Rechnung) und Newsletter-Häkchen ausfüllen.
- [ ] „Zahlungspflichtig buchen“ → Stripe: Betrag stimmt (Lounge, Freiverzehr, Gebühr), nur Karte/Apple Pay/Google Pay/PayPal.
- [ ] Mit eigener Karte oder PayPal bezahlen.
- [ ] Erfolgsseite: Taler-Regen, Countdown, PDF, Geschenk-Karte, Kalender, „Per WhatsApp einladen“.

## 3. Mails

- [ ] Ticket-Mail kommt innerhalb einer Minute: QR-Code, PDF-Anhang, Kalender-Anhang (.ics), Links (PDF, Geschenk-Karte, Kalender, Google Kalender, ggf. Wallet).
- [ ] Rechnung von Stripe kommt (Firmenname, ggf. USt-ID).
- [ ] Newsletter: Bestätigungsmail von Brevo (Double-Opt-in) kommt, Link bestätigen → Seite „Newsletter bestätigt“.
- [ ] Brevo: Kontakt steht in der Liste „Lounge-Buchungen“.
- [ ] .ics-Datei auf iPhone und in Outlook öffnen: Uhrzeit stimmt (Berliner Zeit).

## 4. Doppelbuchung und Abbruch

- [ ] Zweites Gerät: dasselbe Zeitfenster ist „gebucht“.
- [ ] Neue Buchung starten und bei Stripe „Zurück“ → Hinweis „Zahlung abgebrochen“, Zeitfenster sofort wieder frei.

## 5. Admin und Händler

- [ ] Admin-Übersicht: Buchung, Umsatz, Händler-Anteil (149 € → 110,25 €, 199 € → 147,75 €), Heatmap.
- [ ] Ticket erneut senden funktioniert.
- [ ] Belegungsplan und Tagesliste drucken.
- [ ] Händler-Zugang (ohne Admin-Rechte): sieht Buchung ohne E-Mail/Telefon, Abrechnung stimmt.

## 6. Einlass

- [ ] `/scan` auf dem Handy, PIN eingeben, QR-Code vom Ticket scannen → grün.
- [ ] „Taler übergeben“ → nochmal scannen → gelb „schon eingecheckt“.
- [ ] Flugmodus an, scannen, Flugmodus aus → Check-in wird nachgetragen.

## 7. Automatik

- [ ] Am Testtag um 10 Uhr: Erinnerungsmail kommt.
- [ ] Am nächsten Morgen 7:45: Tagesbericht kommt (innerhalb der Saison).
- [ ] Warteliste: Testtag ausbuchen, Eintrag machen, eine Buchung stornieren → Mail „Wieder frei“ innerhalb von 10 Minuten.

## 8. Aufräumen

- [ ] Testbuchung im Admin stornieren und in Stripe erstatten.
- [ ] Testdaten mit `scripts/testdaten-zuruecksetzen.sql` entfernen (nur vor dem echten Verkaufsstart!).
- [ ] Testtag im Kalender wieder freigeben.
