# CLAUDE.md – Weihnachtsmarkt-Lounge der Händler

Dauerhafte Projektregeln. Gilt für jede Session. Details stehen in `SPEC.md`.

## Projekt

Mobile-first One-Page-Website, über die eine überdachte Lounge auf dem Weihnachtsmarkt im Schlosspark Detmold gebucht und per Stripe bezahlt wird. Gäste erhalten ein Ticket (QR-Code + PDF) per E-Mail über Brevo. Geschützte Bereiche: `/admin` (Studio F), `/haendler` (nur lesen), `/scan` (Mitarbeiter mit PIN).

## Beteiligte

- **Die Händler (Werbegemeinschaft Detmold e. V.)**: Gastgeber, ihr Logo steht im Mittelpunkt.
- **MF Coaching & Promotion GmbH**: Verkäufer, Zahlungsempfänger (Stripe), Verantwortlicher im Datenschutz, Absender der Rechnungen. Betreibt auch STUDIO/F (Brevo-Konto, Newsletter).
- **STUDIO/F** (studio-f.club): technischer Betreiber, erscheint nur im Footer als „Powered by STUDIO/F“.
- **Tanzschule Fricke**: Tischservice an der Lounge.

## Geschäftsregeln – NIE brechen

- Preis 175,00 € + 3,50 € Vorverkaufsgebühr = **178,50 €**. Beträge in Cent, immer aus `settings`, nie hart codiert.
- **Preisanzeige (Entscheidung Louis, Design-Runde 2):** Beworben wird **„175 €“** mit dem Zusatz „zzgl. 3,50 € Vorverkaufsgebühr“ (klein, direkt daneben). Der Gesamtpreis 178,50 € erscheint in der Buchungs-Zusammenfassung und im Checkout. ⚠ PAngV-Risiko (Gesamtpreisangabe) – vom Anwalt prüfen lassen.
- Alle Werbe-Buttons heißen **„Lounge buchen“**. Nur der Abschluss-Button im Formular heißt „Zahlungspflichtig buchen“ (§ 312j BGB).
- Der Anlass ist bei der Buchung **optional**.
- Die **100 € Freiverzehr** werden groß herausgestellt (Hero, Eckdaten-Band).
- Enthalten: Lounge exklusiv 2 Stunden, bis 10 Personen, 100 Residenztaler (je 1 €, pro gekauftem Artikel 1 Taler), Tischservice der Tanzschule Fricke.
- Zeitfenster Mo–Fr 17:00–19:00 / 19:00–21:00, Sa–So 17:30–19:30 / 19:30–21:30. Zeitzone immer **Europe/Berlin**.
- Saison, Schließtage, gesperrte Zeitfenster: im Admin einstellbar.
- Jedes Zeitfenster genau einmal verkaufbar (partieller Unique-Index auf `(date, start_time)` für `pending`/`paid`).
- **Online-Buchungsschluss:** `settings.booking_cutoff_minutes` (Standard 60) vor Beginn. Reservierung beim Checkout: `settings.hold_minutes` (30).
- Buchungen sind verbindlich, keine Stornierung durch Gäste, kein Widerrufsrecht (§ 312g Abs. 2 Nr. 9 BGB). Ticket ist **übertragbar**, keine Namensprüfung.
- Ein QR-Code pro Buchung. Inhalt nur der `ticket_token`.
- Zahlungsarten: Karte, Apple Pay, Google Pay, PayPal. **Keine** verzögerten Methoden (SEPA, Klarna, Überweisung über Stripe).
- **Keine Rabattcodes.**
- Abrechnung: Pro Buchung mit `status='paid'` und `include_in_settlement=true` erhalten die Händler `haendler_share_cents` (137,50 €), auch bei No-Show. Stornierte zählen nicht. Studio-F-Anteil = `amount_total_cents − haendler_share_cents`. Beträge werden beim Anlegen in die Buchung kopiert, Preisänderungen wirken nur auf neue Buchungen.
- Rechnung automatisch über Stripe, wenn Firmenname angegeben ODER „Ich benötige eine Rechnung“ angehakt. Optional USt-ID.
- Newsletter nur per freiwilliger Checkbox (nicht vorausgewählt) + Brevo-Double-Opt-in. Alle Bucher kommen in die Liste „Lounge-Buchungen“ (keine Werbung).
- Tracking ohne Cookies, ohne localStorage-IDs, ohne IP-Speicherung: `page_view`, `book_click`, Buchungen.
- Kundendaten werden nach der Saison (Stichtag 31. März) per Admin-Aktion anonymisiert; Beträge und Statistik bleiben.

## Rollen

- `studio_admin`: alles. **2FA (TOTP) Pflicht** – Admin-Funktionen prüfen `aal2`.
- `haendler`: Dashboard, Buchungsliste ohne E-Mail/Telefon/Adresse/Wünsche/USt-ID, Abrechnung, Export. Nur lesen. 2FA optional.
- Scanner: kein Konto. `/scan` + 6-stellige PIN → signiertes Token (12 h, enthält `scanner_token_version`). Nur Edge Functions.
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
- Statischer Build, später Mittwald mit `.htaccess`-SPA-Fallback. Vorschau: Cloudflare Pages (noindex).
- Deployment: GitHub Action spielt bei Push auf `main` Migrations + Functions ein.
- Tests: Vitest (Kernlogik: Preise, Abrechnung, Zeitfenster, Zeitzone), pgTAP/SQL-Tests (RLS, Doppelbuchung), Playwright (Buchung mit Stripe-Testkarte). CI bei jedem Push.

## Design (Stand Design-Runde 2, 04.10.2026)

- Look: **hell & festlich** im Stil von weihnachtsmarkt-detmold.de. Creme-Papier als Grundfläche, dunkle Schrift, Gold-Glitzer als Akzent (Bänder, Preis-Karte, Schritt-Nummern). Dunkelbraun nur für Header, Hero-Foto und Footer. **Keine dunklen Elemente auf dunklem Grund.**
- Tokens (nur in `src/styles/index.css` pflegen): Papier `#FBF7EF`, Fläche `#FFFFFF`, Sand `#F3EBDC`, Linie `#E4D8C2`, Tinte `#23201B`, Tinte weich `#5F574B`, Gold `#C6A45C` (Flächen), Gold tief `#7A5A1E` (Text auf hell), Gold hell `#E8D6A8` (auf dunkel), Braun `#24221E`, Text auf dunkel `#F8F3E8`, Händler-Rot `#CD131C` (sparsam).
- Gold-Glitzer-Textur und Markt-Schriftzug stammen von weihnachtsmarkt-detmold.de (Platzhalter, Nutzung vor Livegang klären).
- **Händler-Logo überall komplett weiß** (Signet-Quadrate als Weißtöne). Auf hellem Grund nur mit dunkelbrauner Unterlage (`plate`).
- Schriften: Jost (Überschriften, geometrisch wie die Markt-Seite), Manrope (Text). Selbst gehostet.
- Hero: Glitzer-Band mit Markt-Schriftzug, darunter großes Foto (Platzhalter „Symbolbild · Bildquelle: Stadt Detmold“) mit Schnee (Canvas nur im Hero).
- Keine Lichterkette mehr.
- Mobil: Header zeigt nur das Händler-Logo zentriert; „Lounge buchen“ steht mobil im Hero und in der festen Leiste unten. Karten mobil kompakt (Icon links, Text rechts).
- Footer: Sponsoren & Partner (weiße Logos), Instagram @diehaendlerdetmold, Link weihnachtsmarkt-detmold.de, „Powered by STUDIO/F“.
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
