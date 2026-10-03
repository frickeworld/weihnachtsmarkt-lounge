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
- **Preisanzeige (PAngV):** groß der Gesamtpreis „178,50 €“, darunter „inkl. 3,50 € Vorverkaufsgebühr“.
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

## Design

- Look: Die Händler × Weihnachtsmarkt im Schlosspark. Edel, warm, festlich.
- Farben: Nachtschwarz `#0F0D0B` (Hintergrund), Kohle `#1A1714` (Flächen), Gold `#C9A24D`, Champagner `#E9D8A6`, Creme `#F6EFE3` (Text), Händler-Rot `#CD131C` (gemessen aus dem Logo-Schriftzug; nur Logo-Umfeld und kleine Akzente), Tannengrün `#1F3A2E` (sparsam).
- Händler-Logo **unverändert** in Originalfarben auf **Creme-Plakette mit Goldrand** (Unterzeile ist dunkelgrau und auf Schwarz nicht lesbar).
- Schriften: Cormorant Garamond (Überschriften), Manrope (Text).
- Ansprache „Du“, warm, hochwertig, erwachsen (30–65). Keine Jugendsprache, keine Emojis. Alle Texte Deutsch.
- Animationen: ein Canvas-Schneefall (70 mobil / 140 Desktop, pausiert bei verstecktem Tab), SVG-Lichterkette mit funkelnden Lämpchen, Gold-Sweep über H1 und Haupt-Buttons, Scroll-Reveal. `prefers-reduced-motion`: nur weiche Einblendungen.
- Mobile-first, große Touch-Flächen (≥ 44 px), WCAG AA, Lighthouse mobil ≥ 85.
- Hero vorerst grafisch; KI-Bilder bzw. echte Fotos werden eingebaut, sobald vorhanden (Vermerk „Symbolbild“ bei KI-Bild).

## Arbeitsweise

- Phase für Phase nach `SPEC.md`. Nach jeder Phase: kurze Zusammenfassung + Testanleitung, dann auf Freigabe warten.
- Nur ändern, was die Phase verlangt. Bereits Gebautes bleibt unverändert.
- Unklar → nachfragen, bevor gebaut wird.
- Vor jedem Push: Lint, Typecheck, Tests grün.
- Commits klein und beschreibend, auf Englisch im Conventional-Commits-Format. UI-Texte immer Deutsch.
- Platzhalter immer als `[PLATZHALTER IN ECKIGEN KLAMMERN]`.
