# CLAUDE.md – Weihnachtsmarkt-Lounge der Händler

Dauerhafte Projektregeln. Gilt für jede Session. Details stehen in `SPEC.md`.

## Projekt

Mobile-first One-Page-Website, über die eine überdachte Lounge auf dem Weihnachtsmarkt im Schlosspark Detmold gebucht und per Stripe bezahlt wird. Gäste erhalten ein Ticket (QR-Code + PDF) per E-Mail über Brevo. Geschützte Bereiche: `/admin` (Studio F), `/haendler` (nur lesen), `/scan` (Mitarbeiter mit PIN).

## Beteiligte

- **Die Händler (Werbegemeinschaft Detmold e. V.)**: Gastgeber, ihr Logo steht im Mittelpunkt.
- **MF Coaching & Promotion GmbH**: Verkäufer, Zahlungsempfänger (Stripe), Verantwortlicher im Datenschutz, Absender der Rechnungen. Betreibt auch STUDIO/F (Brevo-Konto, Newsletter).
- **STUDIO/F** (studio-f.club): technischer Betreiber und Ansprechpartner für alle Fragen zur Buchung (Kontaktbereich mit Formular → `settings.contact_email`, info@studio-f.club). Im Footer groß „Powered by STUDIO/F“ (Entscheidung Louis, 04.10.2026).
- **Tanzschule Fricke**: Tischservice an der Lounge.

## Geschäftsregeln – NIE brechen

- **Preisstaffel (Entscheidung Louis/Oliver, 05.10.2026):** **Verkaufsgebühr 5 % statt 3,50 € fest (Entscheidung Louis, 04.11.2026):** Endpreis = Lounge-Preis + **genau 5 % auf den Cent** (Entscheidung Louis, 04.11.2026; vorher auf volle Euro gerundet) (`settings.fee_percent`, `slot_fee()`); die Gebühr geht an Studio F und heißt für Gäste überall **„Verarbeitungsgebühr“** (Entscheidung Louis, 04.11.2026; vorher „Vorverkaufsgebühr“). Endpreise: Mo–Do 14:30 **103,95 €** (Lounge 99 €, 50 € Freiverzehr); Mo–Do 16:45/19:00 und So ganztags **156,45 €** (149 €, 75 €); Fr–Sa 15:30 **156,45 €** (75 €); Fr–Sa 17:45/20:00 **208,95 €** (199 €, 100 €). Sonderveranstaltungen (Partys, Live-Auftritte) mit eigenem Preis je Termin (`slot_specials`). Weihnachten 2026 (Entscheidung Louis, 13.10.2026): Party-Abende 22./23./29./30.12. (16:45 und 19:00) **198,45 €** (189 € + 5 %, 100 €); Heiligabend exklusiv 24.12. nur 10:00–13:00 **313,95 €** (299 € + 5 %, 150 €). **Saison 30.11.–30.12.2026** (Entscheidung Louis, 04.11.2026); geschlossen 25. und 26.12. sowie 31.12.; 27./28.12. normal geöffnet. Einmalige Zeitfenster in `extra_slots`. Beträge in Cent, immer aus der Datenbank (`slot_pricing()`), nie hart codiert. Der Mo–Do-Nachmittag (14:30) ist seit 27.10.2026 wieder im Angebot (Entscheidung Louis; vom 07.10. bis 27.10.2026 gestrichen).
- **Preisanzeige (Entscheidung Louis, 04.11.2026):** Beworben wird der günstigste **Lounge-Preis ohne Gebühr**, derzeit **„ab 99 €“** mit Hinweis „zzgl. 5 % Verarbeitungsgebühr“ (Abmahnrisiko nach § 3 PAngV bewusst in Kauf genommen). Preisübersicht, Kalender, Sondertermine **und die Buchungsübersicht** zeigen nur Lounge-Preise (Hinweis „zzgl. 5 % Verarbeitungsgebühr, die beim Bezahlen hinzugerechnet wird“); der Knopf heißt „Zahlungspflichtig buchen“ ohne Betrag. Gebühr und Gesamtpreis erscheinen erst auf der Stripe-Zahlungsseite (Entscheidung Louis, 04.11.2026; Risiko nach § 312j BGB bewusst in Kauf genommen). Die AGB nennen beide Preise.
- Alle Werbe-Buttons heißen **„Lounge buchen“**. Nur der Abschluss-Button im Formular heißt „Zahlungspflichtig buchen“ (§ 312j BGB).
- Der Anlass ist bei der Buchung **optional**.
- Der **Freiverzehr (bis zu 100 €)** wird groß herausgestellt (Hero, Eckdaten-Band).
- Enthalten: Lounge exklusiv 2 Stunden, bis 10 Personen, Residenztaler in Höhe des Freiverzehrs (50/75/100/150, je 1 €, pro gekauftem Artikel 1 Taler), Tischservice der Tanzschule Fricke.
- Zeitfenster Mo–Do 14:30–16:30 / 16:45–18:45 / 19:00–21:00, So 14:30–16:30 / 16:45–18:45 / 19:00–21:00, Fr–Sa 15:30–17:30 / 17:45–19:45 / 20:00–22:00 (`slot_templates`). Zeitzone immer **Europe/Berlin**.
- Saison, Schließtage, gesperrte Zeitfenster: im Admin einstellbar.
- Jedes Zeitfenster genau einmal verkaufbar (partieller Unique-Index auf `(date, start_time)` für `pending`/`paid`).
- **Online-Buchungsschluss:** `settings.booking_cutoff_minutes` (Standard 60) vor Beginn. Reservierung beim Checkout: `settings.hold_minutes` (30).
- Buchungen sind verbindlich, keine Stornierung durch Gäste, kein Widerrufsrecht (§ 312g Abs. 2 Nr. 9 BGB). Ticket ist **übertragbar**, keine Namensprüfung.
- Ein QR-Code pro Buchung. Inhalt nur der `ticket_token`.
- Zahlungsarten: Karte, Apple Pay, Google Pay, PayPal. **Keine** verzögerten Methoden (SEPA, Klarna, Überweisung über Stripe).
- **Keine öffentlichen Rabattcodes.** Einzige Ausnahme (Entscheidung Louis, 07.10.2026): persönliche Codes aus dem Gewinnspiel – Trostpreis `settings.giveaway_discount_percent` (**25 %**, Entscheidung Louis 04.11.2026; vorher 30 % nur Mo–Do) an allen Tagen außer Sonderveranstaltungen (Party-Abende, Heiligabend), einmal einlösbar, **nur 48 Stunden nach der Ziehung einlösbar** (`discount_codes.redeem_by`, `settings.giveaway_code_hours`), Termin bis Saisonende; Gewinn-Code 100 % für einen freien Abend (alle Tage, keine Sonderveranstaltungen). Preis rechnet nur `discount_pricing()` auf dem Server. Freiverzehr bleibt immer voll; beim Rabatt bekommen die Händler 72 % vom rabattierten Lounge-Preis, mindestens den Freiverzehr (25 %: 156,45 € → 117,34 €, Händler 79,12 €); beim Gewinn tragen Händler und Studio F den Freiverzehr je zur Hälfte (Betrag 0 €, Händler-Anteil = halber Freiverzehr).
- Abrechnung (**neue Aufteilung, Entscheidung Louis 04.11.2026**; vorher Freiverzehr + Hälfte des Rests): Pro Buchung mit `status='paid'` und `include_in_settlement=true` erhalten die Händler `haendler_share_cents` = **72 % vom Lounge-Preis** (Endpreis − Gebühr), mindestens der volle Freiverzehr: 71,28 € / 107,28 € / 143,28 € (Party 136,08 €, Heiligabend 215,28 €); STUDIO/F bzw. MF Coaching bekommt **28 % vom Lounge-Preis plus die 5 % Gebühr** (`settings.studio_share_percent`, im Admin änderbar). Je Preisstufe oder Sondertermin überschreibbar. Die Händler stellen im Januar eine Rechnung über ihren Anteil; ihr Bereich zeigt ihn live. Auch bei No-Show. Stornierte zählen nicht. Studio-F-Anteil = `amount_total_cents − haendler_share_cents`. Beträge werden beim Anlegen in die Buchung kopiert, Preisänderungen wirken nur auf neue Buchungen.
- Rechnung automatisch über Stripe, wenn Firmenname angegeben ODER „Ich benötige eine Rechnung“ angehakt. Optional USt-ID.
- Newsletter bei der Buchung nur per freiwilliger Checkbox (nicht vorausgewählt), **Single-Opt-in** (Entscheidung Louis, 04.11.2026: keine Bestätigungsmail, Risiko bewusst in Kauf genommen). **Gewinnspiel** (Veranstalter Die Händler e. V., `/gewinnspiel`): Teilnahme = Newsletter-Anmeldung (deutlich beschriftet, eigenes Double-Opt-in), **automatische Ziehung jeden Sonntag 18:00 Uhr** (pg_cron → Edge Function `giveaway-draw`, Entscheidung Louis 04.11.2026; Knopf im Admin nur zum Nachholen), Countdown auf der Startseite und laufende Gold-Leiste „Lounge gewinnen“ oben, 1 Extra-Los je bestätigtem Freund; ⚠ Kopplung vom Anwalt prüfen lassen. Alle Bucher kommen in die Liste „Lounge-Buchungen“ (keine Werbung).
- Tracking ohne Cookies, ohne localStorage-IDs, ohne IP-Speicherung: `page_view`, `book_click`, Buchungen.
- Kundendaten werden nach der Saison (Stichtag 31. März) anonymisiert; Beträge und Statistik bleiben. Kein Menüpunkt im Admin mehr (Entscheidung Louis, 05.11.2026) – Studio F führt `admin_anonymize_before()` im SQL Editor aus (`LIVE-SCHALTUNG.md`).

## Rollen

- `studio_admin`: alles. **2FA (TOTP) Pflicht** – Admin-Funktionen prüfen `aal2`.
- `haendler`: Dashboard, Buchungsliste ohne E-Mail/Telefon/Adresse/Wünsche/USt-ID, Abrechnung, Export. Nur lesen. 2FA optional.
- Scanner: kein Konto. `/scan` + 4-stellige PIN (Entscheidung Louis, 05.11.2026; 5 Fehlversuche je Gerät → 15 Min. Sperre, 20 insgesamt pro Stunde → 1 Std. Pause) → signiertes Token (12 h, enthält `scanner_token_version`). Nur Edge Functions.
- Öffentliche Registrierung aus. Zugänge nur per Einladung aus dem Admin.
- Admin darf bei manuellen Buchungen Buchungsschluss, Sperren und Saison übergehen (mit Warnung). Doppelbuchung bleibt unmöglich.

## Technik

- Vite + React + TypeScript (strict) + Tailwind + framer-motion, react-router, react-hook-form + zod.
- Supabase (eigenes Projekt, Frankfurt): Postgres, Auth (+MFA), Edge Functions (Deno), Storage, pg_cron.
- **Ein** Supabase-Projekt für Test und Live → Migrations **nur additiv** (nichts löschen/umbenennen ohne ausdrückliche Freigabe). `main` = live.
- Schema nur über versionierte Migrations in `supabase/migrations`. Keine Änderungen per Dashboard.
- RLS auf **allen** Tabellen. Rollen in `user_roles`, Prüfung über `has_role()` (security definer, `search_path` fixiert).
- Geld- und Statusänderungen **nur serverseitig** (Edge Functions, Stripe-Webhook). Der Client setzt nie Preise oder Status.
- Secrets nur als Supabase-/GitHub-Secrets bzw. `.env.local` (gitignored). Nie im Frontend, nie im Repo, nie im Chat.
- Im Frontend nur `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`.
- Alle URLs über `PUBLIC_SITE_URL`. Keine Domain hart codieren.
- Datenschutz: Fonts über @fontsource, kein Google-Fonts-CDN, keine eingebetteten Karten, keine Drittanbieter-Skripte ohne Rückfrage.
- Statischer Build. Live bei **Mittwald mStudio auf einer Studio-F-Subdomain**, z. B. `weihnachtslounge.studio-f.club`, in einem eigenen mStudio-Projekt auf dem Space-Server „Sen-Yoga“ (Entscheidung Louis, 04.11.2026; vorher Strato geplant). Die Studio-F-Website (studio-f.club, altes Kundencenter) **nie anfassen** – dort nur der DNS-Eintrag der Subdomain. Toms WordPress-Seite des Weihnachtsmarkts ist die Infoseite und verlinkt auf die Buchungsseite, kein iFrame (Stripe Checkout). App „PHP – Eigene App“ (Apache, liest `.htaccess`), Upload per GitHub Action (`deploy-site.yml` → `scripts/deploy-sftp.sh`, SFTP, löscht nie etwas, überspringt ohne Zugang), Anleitung `docs/MITTWALD.md`. Adresse und ggf. Unterordner ergeben sich nur aus `VITE_PUBLIC_SITE_URL`. Interne Links laufen über den Router oder `import.meta.env.BASE_URL`, nie mit fest geschriebenem `/`. Vorschau: Cloudflare Pages (noindex).
- Deployment: GitHub Action spielt bei Push auf `main` Migrations + Functions ein.
- Tests: Vitest (Kernlogik: Preise, Abrechnung, Zeitfenster, Zeitzone), pgTAP/SQL-Tests (RLS, Doppelbuchung), Playwright (Buchung mit Stripe-Testkarte). CI bei jedem Push.

## Design (Stand Design-Runde 2, 04.10.2026)

- Look: **hell & festlich** im Stil von weihnachtsmarkt-detmold.de. Creme-Papier als Grundfläche, dunkle Schrift, Gold-Glitzer als Akzent (Bänder, Preis-Karte, Schritt-Nummern). **Tannengrün** (CI der Markt-Seite, Entscheidung Louis 04.11.2026; vorher Dunkelbraun) für Header, Hero-Foto, Footer und den Abschnitt „Partys und besondere Abende“. **Keine dunklen Elemente auf dunklem Grund.**
- Tokens (nur in `src/styles/index.css` pflegen): Papier `#FBF7EF`, Fläche `#FFFFFF`, Sand `#F3EBDC`, Linie `#E4D8C2`, Tinte `#23201B`, Tinte weich `#5F574B`, Gold `#C6A45C` (Flächen), Gold tief `#7A5A1E` (Text auf hell), Gold hell `#E8D6A8` (auf dunkel), Tannengrün `#13251C` (Token `brown`), Grüngrau `#E9EDE6` (Token `mist`), Text auf dunkel `#F8F3E8`, Händler-Rot `#CD131C` (sparsam).
- Gold-Glitzer-Textur und Markt-Schriftzug stammen von weihnachtsmarkt-detmold.de (Platzhalter, Nutzung vor Livegang klären).
- **Händler-Logo überall komplett weiß** (Signet-Quadrate als Weißtöne). Auf hellem Grund nur mit tannengrüner Unterlage (`plate`).
- Schriften: Jost (Überschriften, geometrisch wie die Markt-Seite), Manrope (Text). Selbst gehostet.
- Hero: Glitzer-Band mit Markt-Schriftzug, darunter großes Foto (Platzhalter „Symbolbild · Bildquelle: Stadt Detmold“) mit Schnee (Canvas nur im Hero).
- Keine Lichterkette mehr.
- Mobil: Header zeigt das Händler-Logo zentriert, rechts nur das Geschenk-Symbol „Lounge gewinnen“ (solange das Gewinnspiel läuft); „Lounge buchen“ steht mobil im Hero und in der festen Leiste unten. Karten mobil kompakt (Icon links, Text rechts).
- Footer: Sponsoren & Partner (weiße Logos), Instagram @diehaendlerdetmold, Link weihnachtsmarkt-detmold.de, Kontakt-Link, großes „Powered by STUDIO/F“.
- Kontaktbereich „Fragen? Wir helfen dir gern.“ (nach FAQ): STUDIO/F-Karte (Logo auf Tannengrün) + Formular (Edge Function `contact`, Honigtopf, max. 5 Nachrichten/Stunde je Gerät, nichts wird gespeichert).
- Ansprache „Du“, warm, hochwertig, erwachsen (30–65). Keine Jugendsprache, keine Emojis. Alle Texte Deutsch.
- `prefers-reduced-motion`: Schnee, Glanz und Funkeln aus, nur weiche Einblendungen.
- Mobile-first, große Touch-Flächen (≥ 44 px), WCAG AA, Lighthouse mobil ≥ 85.

## Arbeitsweise

- Phase für Phase nach `SPEC.md`. Nach jeder Phase: kurze Zusammenfassung + Testanleitung, dann auf Freigabe warten.
- Nur ändern, was die Phase verlangt. Bereits Gebautes bleibt unverändert.
- Unklar → nachfragen, bevor gebaut wird.
- Vor jedem Push: Lint, Typecheck, Tests grün.
- Commits klein und beschreibend, auf Englisch im Conventional-Commits-Format. UI-Texte immer Deutsch.
- Platzhalter immer als `[PLATZHALTER IN ECKIGEN KLAMMERN]`.
