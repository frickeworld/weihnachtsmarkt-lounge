# SPEC – Weihnachtsmarkt-Lounge der Händler

Stand: 3. Okt. 2026 · Verantwortlich: Louis Fricke · Projektregeln: `CLAUDE.md`

---

## 1. Überblick

| Thema                    | Festlegung                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Produkt                  | Überdachte Lounge, Weihnachtsmarkt im Schlosspark Detmold, bis 10 Personen, 2 h exklusiv                  |
| Preis                    | 175,00 € + 3,50 € Vorverkaufsgebühr = 178,50 € (Anzeige: groß 178,50 €, „inkl. 3,50 € Vorverkaufsgebühr“) |
| Zeitfenster              | Mo–Fr 17:00–19:00, 19:00–21:00 · Sa–So 17:30–19:30, 19:30–21:30 (Europe/Berlin)                           |
| Buchungsschluss online   | 60 min vor Beginn (`settings.booking_cutoff_minutes`)                                                     |
| Reservierung im Checkout | 30 min (`settings.hold_minutes`)                                                                          |
| Stornierung              | Keine durch Gäste. Admin kann stornieren, Erstattung manuell in Stripe                                    |
| Zahlung                  | Stripe Checkout (MF Coaching & Promotion GmbH): Karte, Apple Pay, Google Pay, PayPal                      |
| Rabattcodes              | Keine                                                                                                     |
| Rechnung                 | Automatisch über Stripe bei Firmenname oder Rechnungswunsch, optional USt-ID                              |
| Ticket                   | Ein QR-Code pro Buchung, Mail mit PDF-Anhang direkt nach Zahlung, Erinnerung am Buchungstag 10:00 Uhr     |
| Übertragbarkeit          | Ja, ohne Namensprüfung                                                                                    |
| Team-Benachrichtigung    | Keine Mail (Admin + Scanner-Liste „Heute“)                                                                |
| Newsletter               | Freiwillige Checkbox + Brevo-Double-Opt-in                                                                |
| Tracking                 | Cookielos: page_view, book_click, Buchungen                                                               |
| Zugänge                  | studio_admin (2FA Pflicht), haendler (2FA optional), Scanner (PIN)                                        |
| Backend                  | Ein Supabase-Projekt (Frankfurt) für Test und Live                                                        |
| Hosting                  | Vorschau Cloudflare Pages · Live Mittwald (Domain offen)                                                  |
| Datenhaltung             | Anonymisierung der Kontaktdaten zum 31. März nach der Saison                                              |

### Geldverteilung pro Buchung

| Posten                      | Betrag       | Geht an                            |
| --------------------------- | ------------ | ---------------------------------- |
| Gast zahlt gesamt           | 178,50 €     | –                                  |
| Vorverkaufsgebühr           | 3,50 €       | Studio F                           |
| Residenztaler               | 100,00 €     | Händler                            |
| Hälfte Lounge-Anteil (75 €) | 37,50 €      | Händler                            |
| Andere Hälfte Lounge-Anteil | 37,50 €      | Studio F                           |
| **Händler gesamt**          | **137,50 €** | auch bei No-Show, nicht bei Storno |

---

## 2. Architektur

```
Browser (statische SPA, Vite/React)
 ├─ öffentlich:   RPC get_public_settings, get_availability, track_event,
 │                get_ticket(token), get_success_info(session_id)
 ├─ Edge Functions: create-checkout, release-hold
 ├─ /admin, /haendler: Supabase Auth (JWT) → RPC/Edge Functions mit has_role()
 └─ /scan: PIN → scanner-auth → Scanner-Token → scanner-* Functions

Stripe ──webhook──▶ stripe-webhook ──▶ bookings.paid ──▶ send-ticket ──▶ Brevo
pg_cron (stündlich) ──▶ send-reminders (verschickt, wenn Berlin-Zeit ≥ 10:00 am Buchungstag)
pg_cron (alle 5 min) ──▶ expire_stale_holds()
```

### Repo-Struktur

```
/assets                  Originaldateien (Logos, Fotos)
/src
  /components            UI-Bausteine (Snowfall, LightString, GoldButton …)
  /sections              One-Pager-Abschnitte
  /pages                 Erfolg, Ticket, Newsletter, Login, Admin, Haendler, Scan, Recht, 404
  /lib                   supabase-Client, Formatierung, Zeit (Europe/Berlin), Preise
  /content               Texte des One-Pagers
/supabase
  /migrations            versionierte SQL-Migrations
  /functions             Edge Functions (+ _shared)
  /tests                 pgTAP-Tests
/tests/e2e               Playwright
/.github/workflows       ci.yml, deploy-supabase.yml
/public                  robots.txt, sitemap.xml, .htaccess, og-image
```

### Umgebungsvariablen

Frontend (`.env.local`, Cloudflare Pages, Build auf Mittwald):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`, `VITE_NOINDEX` (true in Vorschau)

GitHub-Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `STRIPE_TEST_SECRET_KEY` (nur für E2E)

Supabase-Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TAX_RATE_LOUNGE` (optional), `STRIPE_TAX_RATE_FEE` (optional), `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `BREVO_LIST_BOOKINGS`, `BREVO_LIST_NEWSLETTER`, `BREVO_DOI_TEMPLATE_ID`, `PUBLIC_SITE_URL`, `SCANNER_TOKEN_SECRET`, `CRON_SECRET`

---

## 3. Datenmodell

Alle Tabellen im Schema `public`, **RLS aktiv**. Zeitstempel `timestamptz`, Daten `date`, Uhrzeiten `time` (Bedeutung immer Europe/Berlin).

### settings (genau eine Zeile, `id = 1`)

| Spalte                 | Typ         | Start                    |
| ---------------------- | ----------- | ------------------------ |
| season_start           | date        | 2026-11-26 (Platzhalter) |
| season_end             | date        | 2026-12-23 (Platzhalter) |
| price_cents            | int         | 17500                    |
| fee_cents              | int         | 350                      |
| taler_count            | int         | 100                      |
| taler_cents            | int         | 10000                    |
| haendler_share_cents   | int         | 13750                    |
| max_persons            | int         | 10                       |
| booking_cutoff_minutes | int         | 60                       |
| hold_minutes           | int         | 30                       |
| checkin_early_minutes  | int         | 30                       |
| contact_email          | text        | info@studio-f.club       |
| scanner_pin_hash       | text        | null                     |
| scanner_token_version  | int         | 1                        |
| updated_at             | timestamptz | now()                    |

Constraint: `haendler_share_cents <= price_cents`, `taler_cents <= price_cents`.

### slot_templates

`id`, `weekday` (1 = Mo … 7 = So), `start_time`, `end_time`, `active` bool. Seed: Mo–Fr 17:00–19:00 und 19:00–21:00, Sa–So 17:30–19:30 und 19:30–21:30.

### closed_dates

`date` (PK), `reason`, `created_at`.

### blocked_slots

`id`, `date`, `start_time`, `reason`, `created_at`. Unique `(date, start_time)`.

### bookings

| Spalte                                                                        | Typ / Werte                                               |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| id                                                                            | uuid PK                                                   |
| booking_code                                                                  | text unique, `HL-XXXX-XXXX`, Alphabet ohne 0/O/1/I/L      |
| ticket_token                                                                  | text unique, 32 Zeichen, kryptografisch zufällig (base62) |
| date, start_time, end_time                                                    |                                                           |
| status                                                                        | `pending` / `paid` / `cancelled` / `expired`              |
| source                                                                        | `online` / `manual`                                       |
| payment_method                                                                | `stripe` / `bar` / `ueberweisung` / `kostenlos`           |
| first_name, last_name, email, phone                                           |                                                           |
| persons                                                                       | 1–10                                                      |
| occasion                                                                      | `firmenfeier` / `familienfeier` / `freunde` / `sonstiges` |
| company_name, vat_id                                                          | optional                                                  |
| invoice_requested                                                             | bool                                                      |
| billing_street, billing_zip, billing_city                                     | Pflicht bei Firma oder Rechnungswunsch                    |
| notes                                                                         | optional                                                  |
| newsletter_opt_in                                                             | bool                                                      |
| terms_accepted_at                                                             | timestamptz                                               |
| price_cents, fee_cents, taler_cents, haendler_share_cents, amount_total_cents | aus settings kopiert                                      |
| include_in_settlement                                                         | bool, Standard true                                       |
| stripe_checkout_session_id, stripe_payment_intent_id, stripe_invoice_url      |                                                           |
| hold_expires_at, paid_at, checked_in_at, taler_handed_out_at                  |                                                           |
| cancelled_at, cancel_reason                                                   |                                                           |
| reminder_sent_at                                                              |                                                           |
| admin_override                                                                | bool (manuelle Buchung hat Regeln übergangen)             |
| created_by                                                                    | uuid (Admin bei manueller Buchung)                        |
| anonymized_at                                                                 |                                                           |
| created_at                                                                    |                                                           |

Indizes: **partieller Unique-Index `(date, start_time) WHERE status IN ('pending','paid')`**, Index auf `status`, `date`, `stripe_checkout_session_id`.

### scan_log

`id`, `booking_id` (nullable), `code_entered`, `result` (`ok` / `already` / `wrong_slot` / `override` / `invalid` / `unpaid` / `taler`), `scanned_at_device` (Gerätezeit), `synced_offline` bool, `created_at`.

### scanner_attempts

`ip_hash` (PK, SHA-256 mit Secret-Salt), `failed_count`, `locked_until`, `updated_at`. Einträge älter als 24 h werden per pg_cron gelöscht.

### page_events

`id`, `event_type` (`page_view` / `book_click`), `device` (`mobile` / `desktop`), `created_at`. Keine IP, kein User-Agent, keine IDs.

### email_log

`id`, `booking_id`, `type` (`ticket` / `reminder` / `doi` / `contact`), `status` (`sent` / `failed`), `error`, `created_at`.

### user_roles

`user_id` (FK auth.users), `role` (`studio_admin` / `haendler`). PK `(user_id, role)`.

### Funktionen (SQL)

| Funktion                       | Zugriff          | Zweck                                                                                                                                                                            |
| ------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `has_role(uid, role)`          | security definer | Rollenprüfung                                                                                                                                                                    |
| `is_admin_aal2()`              | security definer | `has_role(auth.uid(),'studio_admin')` UND `auth.jwt()->>'aal' = 'aal2'`                                                                                                          |
| `expire_stale_holds()`         | intern           | `pending` mit `hold_expires_at < now()` → `expired`                                                                                                                              |
| `get_public_settings()`        | anon             | price, fee, taler_count, max_persons, season_start/end, contact_email, booking_cutoff_minutes                                                                                    |
| `get_availability(from, to)`   | anon             | pro Tag/Zeitfenster: `free` / `taken` / `blocked` / `closed` / `past` / `out_of_season`. `past` ab Beginn minus `booking_cutoff_minutes` (Berlin). Keine personenbezogenen Daten |
| `track_event(type, device)`    | anon             | Whitelist-Prüfung, Insert in page_events                                                                                                                                         |
| `get_ticket(token)`            | anon             | first_name, booking_code, date, start/end, persons, status, checked_in_at, ticket_token                                                                                          |
| `get_success_info(session_id)` | anon             | first_name, date, start/end, booking_code, status                                                                                                                                |
| `haendler_*`                   | haendler/admin   | Kennzahlen, Buchungsliste, Abrechnung ohne Kontaktdaten                                                                                                                          |
| `admin_*`                      | admin aal2       | Kennzahlen, Kalender, Einstellungen                                                                                                                                              |

### RLS-Matrix

| Tabelle                                               | anon                | haendler           | studio_admin (aal2)                                 |
| ----------------------------------------------------- | ------------------- | ------------------ | --------------------------------------------------- |
| settings, slot_templates, closed_dates, blocked_slots | – (nur Funktionen)  | –                  | lesen/schreiben                                     |
| bookings                                              | –                   | – (nur Funktionen) | lesen/schreiben (Status/Beträge nur über Functions) |
| page_events                                           | – (nur track_event) | lesen              | lesen                                               |
| scan_log, email_log, scanner_attempts                 | –                   | –                  | lesen                                               |
| user_roles                                            | –                   | eigene Zeile lesen | lesen/schreiben                                     |

Spalten `scanner_pin_hash` sind nie über eine öffentliche Funktion erreichbar.

---

## 4. Abläufe

### 4.1 Online-Buchung

1. Kalender lädt `get_availability` für den sichtbaren Monat (beim Öffnen von #buchen und nach jeder Auswahl).
2. Gast wählt Tag → Zeitfenster → füllt Formular (Validierung zod im Browser).
3. „Zahlungspflichtig buchen – 178,50 €“ → `create-checkout`:
   - zod-Validierung serverseitig (E-Mail, Telefon, Personen 1–max_persons, Anlass, AGB = true, Rechnungsadresse Pflicht bei Firma/Rechnungswunsch, USt-ID optional mit Formatprüfung).
   - `expire_stale_holds()`.
   - Prüfen: in Saison, nicht geschlossen, nicht gesperrt, Slot existiert laut slot_templates, Beginn − cutoff > jetzt.
   - Insert `pending`, `hold_expires_at = now() + hold_minutes`, Beträge aus settings, `amount_total_cents = price + fee`.
   - Unique-Verletzung → 409 „Dieser Termin wurde gerade gebucht. Bitte wähle einen anderen.“ → Frontend lädt Verfügbarkeit neu.
   - Stripe Checkout Session: `mode=payment`, `locale=de`, `currency=eur`, `customer_email`, `expires_at = hold_expires_at` (Stripe-Minimum 30 min beachten), `payment_method_types` = card + paypal (Apple/Google Pay über card), `metadata.booking_id`, success/cancel-URL über PUBLIC_SITE_URL.
   - Positionen: „Weihnachtsmarkt-Lounge am [Datum], [Zeitfenster] – bis zu 10 Personen“ = price − taler (75,00 €) · „Freiverzehr: 100 Residenztaler“ = taler (100,00 €) · „Vorverkaufsgebühr“ = fee (3,50 €). Tax-Rates nur, wenn Secrets gesetzt (Lounge + Gebühr; Taler ohne).
   - Bei Firma/Rechnungswunsch: Stripe-Customer (Name = Firma sonst Vor-/Nachname, E-Mail, Adresse, USt-ID als `eu_vat` Tax-ID), `invoice_creation.enabled = true`, Beschreibung mit Datum, Zeitfenster, Buchungscode.
   - Session-ID speichern, Redirect-URL zurückgeben.
4. **Webhook** `stripe-webhook` (ohne JWT, Signatur prüfen):
   - `checkout.session.completed` + `payment_status=paid`: wenn noch nicht `paid` → `paid`, `paid_at`, `amount_total_cents` (aus Stripe gegenprüfen), Payment-Intent, Rechnungs-URL. Danach `send-ticket`. Idempotent.
   - Sonderfall: Buchung inzwischen `expired`, Slot aber frei → wieder `paid` setzen. Slot vergeben → Buchung `cancelled` mit Grund „Doppelzahlung – Erstattung nötig“, sichtbar im Admin.
   - `checkout.session.expired` → `expired`, falls noch `pending`.
5. **Abbruch** `?abbruch=[booking_id]` → `release-hold`: nur wenn `pending` und Session nicht bezahlt → Session expire, Buchung `expired`. Hinweis „Zahlung abgebrochen. Du kannst es gleich noch einmal versuchen.“
6. **/buchung/erfolg**: `get_success_info`, Polling alle 2 s bis 20 s, danach „Deine Zahlung wird bestätigt – du bekommst gleich eine E-Mail.“ noindex.

### 4.2 Ticket und E-Mails

- `send-ticket(booking_id)` (aufrufbar vom Webhook, von manueller Buchung und als „Ticket erneut senden“ durch Admin):
  - QR-PNG (Inhalt `ticket_token`, Fehlerkorrektur H, 600 px) → Storage-Bucket `tickets` (Dateiname = Token, öffentlich lesbar über unratbaren Namen).
  - PDF-Ticket (A4 bzw. A6-Layout, pdf-lib): Händler-Logo auf Creme, Datum + Zeitfenster groß, QR, Buchungscode, Personen, Taler-Regel, Tischservice, Ort, Pünktlichkeit, Verbindlichkeit, Kurz-Impressum.
  - Brevo `POST /v3/smtp/email` mit HTML + Text + PDF-Anhang. Betreff: „Dein Ticket: Weihnachtsmarkt-Lounge am [Wochentag, Datum]“.
  - Inhalt: „Hallo [Vorname], deine Lounge ist gebucht!“, Datum/Zeitfenster, QR + Code, Personen, „Was dich erwartet“, Ort [GENAUE POSITION], „Bitte sei pünktlich – dein Zeitfenster endet um [Endzeit] Uhr.“, „Deine Buchung ist verbindlich. Du kannst dein Ticket aber an andere weitergeben.“, Button „Ticket online öffnen“, ggf. Rechnungslink, Footer Kurz-Impressum + „Powered by STUDIO/F“.
  - Brevo-Kontakt (`updateEnabled: true`) in `BREVO_LIST_BOOKINGS` mit Vorname, Nachname, Firma. Fehler nur loggen.
  - `newsletter_opt_in` → `POST /v3/contacts/doubleOptinConfirmation` (Liste Newsletter, Template-ID, redirect `/newsletter/bestaetigt`). Fehler nur loggen.
  - Jeder Versuch in `email_log`.
- `send-reminders` (pg_cron stündlich, geschützt per `CRON_SECRET`): Buchungen `paid`, Datum = heute (Berlin), Berlin-Zeit ≥ 10:00, `reminder_sent_at IS NULL`, `created_at` vor heute 10:00 Uhr Berlin → Erinnerungsmail mit PDF, Betreff „Heute ist es so weit: deine Lounge um [Startzeit] Uhr“. `reminder_sent_at` setzen (genau einmal).
- Login-Mails (Einladung, Passwort, MFA) zunächst über Supabase-Standard, vor Livegang über Brevo-SMTP mit studio-f.club-Absender.

### 4.3 Manuelle Buchung (Admin)

Formular wie online + Zahlungsart (bar / Überweisung / kostenlos) + Schalter „In Händler-Abrechnung aufnehmen“ (Standard an, bei „kostenlos“ automatisch aus). Status `paid`, `source=manual`. Regeln (Saison, Sperre, Buchungsschluss) dürfen mit Warnung übergangen werden → `admin_override=true`. Unique-Index gilt immer. Ticket per Brevo. Bei „kostenlos“ ist `amount_total_cents = 0`, die gespeicherten Anteile bleiben, `include_in_settlement=false`.

### 4.4 Storno (nur Admin)

Pflichtfeld Grund → `cancelled`, `cancelled_at`, `cancel_reason`. Hinweis „Die Erstattung bitte manuell in Stripe auslösen“ + Link zum Payment-Intent. Zeitfenster wieder frei, zählt nicht in der Abrechnung.

### 4.5 Scanner

- `scanner-auth(pin)`: Rate-Limit über `scanner_attempts` (5 Fehlversuche → 10 min Sperre), bcrypt-Vergleich, Token = HMAC-signiert `{exp: +12h, v: scanner_token_version}` → sessionStorage.
- `scanner-scan(token, code)`: Code = ticket_token oder booking_code (HL-…). Ergebnis:
  - **Grün** „Gültig“: paid, Datum heute, jetzt ≥ Beginn − `checkin_early_minutes` und ≤ Ende → `checked_in_at` setzen.
  - **Gelb** „Bereits eingecheckt um [Uhrzeit]“ + Taler-Status.
  - **Orange** „Anderer Termin“ (anderer Tag oder anderes Zeitfenster) + „Trotzdem einchecken“ → `override`.
  - **Rot** „Ungültig“: unbekannt, nicht bezahlt, storniert.
- `scanner-taler(token, booking_id)` → `taler_handed_out_at`.
- `scanner-today(token)`: Buchungen heute (Name, Firma, Personen, Zeitfenster, Status). Wird lokal gecacht (IndexedDB/sessionStorage), offline anzeigbar.
- **Offline:** Scan prüft gegen die gecachte Tagesliste, zeigt Ergebnis mit Hinweis „offline“, legt Check-in/Taler in eine lokale Warteschlange; Sync bei Netz mit `scanned_at_device` und `synced_offline=true`. Konflikte (bereits eingecheckt) werden serverseitig geloggt, nie überschrieben.
- Jede Aktion → `scan_log`. Taschenlampe über `MediaStreamTrack.applyConstraints({advanced:[{torch:true}]})`, wenn unterstützt. Ton + Vibration. noindex.
- PIN-Wechsel im Admin erhöht `scanner_token_version` → alle Tokens ungültig.

### 4.6 Händler-Bereich

- Übersicht: Kennzahlen wie Admin, statt „davon Studio F“ nur „Euer Anteil“. Zeitraumfilter, Tagesdiagramm.
- Buchungen: Datum, Zeitfenster, Name, Firma, Personen, Anlass, Status (bezahlt/storniert), eingecheckt (+Uhrzeit), Taler übergeben, „Nicht erschienen“ für vergangene ohne Check-in. Filter, Suche.
- Abrechnung: Zeitraum (Standard Saison). Zählt `paid` + `include_in_settlement`. Summen aus gespeicherten Beträgen. Einzelaufstellung. CSV (Semikolon, UTF-8 BOM) + PDF „Abrechnungsübersicht Weihnachtsmarkt-Lounge [Zeitraum]“ mit Fußzeile „Grundlage für eure Rechnung an die MF Coaching & Promotion GmbH. Dies ist keine Rechnung.“ Gleiche Seite im Admin.

### 4.7 Admin

1. Übersicht: Zeitraumfilter (Heute, 7 Tage, Saison, frei). Kennzahlen: Aufrufe, Klicks, bezahlte Buchungen, Abschlussquote (Buchungen ÷ Klicks), Auslastung (verkauft ÷ verfügbar), Umsatz brutto, davon Händler, davon Studio F, Check-ins, No-Shows, übergebene Taler. Diagramm pro Tag. Block „Heute“.
2. Buchungen: Tabelle, Suche, Filter, Detail inkl. Kontakt, Stripe-Links, email_log. Aktionen: Ticket erneut senden, manuell einchecken, Taler markieren, stornieren.
3. Manuelle Buchung (4.3).
4. Kalender: Monatsansicht (frei, reserviert, gebucht, gesperrt, geschlossen), Zeitfenster sperren/entsperren, Tage schließen/öffnen, Buchung öffnen.
5. Einstellungen: Saison, Zeitfenster pro Wochentag, Preis, Gebühr, Taler, Händler-Anteil, Buchungsschluss, Reservierungsdauer, Kontakt-E-Mail, Scanner-PIN (6 Ziffern, einmal angezeigt). Hinweis „Preisänderungen gelten nur für neue Buchungen“.
6. Zugänge: Einladen (`auth.admin.inviteUserByEmail`) mit Rolle, Rolle ändern, Zugang entziehen.
7. Export: CSV aller Buchungen im Zeitraum. **Tagesliste als PDF** zum Ausdrucken (Netz-Fallback).
8. Abrechnung (wie Händler, plus Studio-F-Anteil).
9. Datenpflege: „Kontaktdaten anonymisieren“ für Buchungen mit Datum < gewähltem Stichtag (Standard: Saisonende; empfohlen ab 31. März). Ersetzt Name/E-Mail/Telefon/Adresse/Wünsche/USt-ID, behält Beträge, Status, Zeitpunkte. Bestätigungsdialog.

Alle Admin-Aktionen serverseitig mit `is_admin_aal2()` geprüft.

### 4.8 Login

`/login` mit E-Mail + Passwort, „Passwort vergessen“. Nach Login: studio_admin → MFA-Einrichtung (falls fehlt) bzw. TOTP-Abfrage → `/admin`; haendler → `/haendler` (MFA optional unter „Konto“); ohne Rolle → „Kein Zugang“. Erster Admin: louis@tanzschule-fricke.de (Anlage im Supabase-Dashboard, SQL für Rolle wird geliefert).

---

## 5. One-Pager – Inhalte

Texte wie im Projektplan, mit diesen Änderungen:

- **Preis-Abschnitt:** groß „178,50 €“, darunter „pro Lounge und Zeitfenster · inkl. 3,50 € Vorverkaufsgebühr“.
- **Erlebnis-Karte 2:** „Holzhütte mit Fellen, Lichterketten und leiser Musik.“ (ohne Kaminfeuer).
- **Mobile Leiste:** „Lounge buchen · 178,50 €“.
- Alle Preise, Personenzahl, Taler und Kontakt-E-Mail dynamisch aus `get_public_settings` (mit statischem Fallback nur für den ersten Render).
- Formular zusätzlich: Feld „USt-ID (optional)“, sichtbar bei Firma/Rechnungswunsch.
- Checkout-Hinweis zum fehlenden Widerrufsrecht direkt über dem Buchen-Button.
- FAQ-Kontakt: info@studio-f.club (aus settings).

Abschnitte: Header · Hero (#start) · Erlebnis (#erlebnis) · Perfekt für (#anlaesse) · Preis und Zeiten (#preis) · Buchung (#buchen) · So funktioniert's (#ablauf) · FAQ (#faq) · Anfahrt (#anfahrt) · Footer.

Logo: Händler-Logo unverändert auf Creme-Plakette mit feinem Goldrand (Header klein, Hero groß, Footer klein). STUDIO/F-Logo (SVG) weiß im Footer.

Meta: Title „Lounge buchen – Weihnachtsmarkt im Schlosspark Detmold | Die Händler“. Description „Deine überdachte Lounge auf dem Detmolder Weihnachtsmarkt: bis zu 10 Personen, 2 Stunden, 100 € Freiverzehr und Tischservice. Jetzt Termin sichern.“

### Bild-Prompt für KI-Bilder (von Louis zu generieren)

> Fotorealistisches Bild, Querformat 16:9 (zusätzlich Hochformat 4:5). Innenraum einer gemütlichen, überdachten Holzhütte auf einem Weihnachtsmarkt am Abend. Warme Holzvertäfelung, kleine Sprossenfenster mit weißen Vorhängen, Tannengirlanden mit warmweißen Lichterketten an den Deckenbalken, goldene Schleifen und ein Kranz an der Wand. Ein langer Holztisch mit Kerzen, Tannenzweigen und Glühweintassen, Holzbänke mit grauen und weißen Fellen. 6 bis 8 gut gelaunte Erwachsene zwischen 35 und 60 in Winterkleidung im Gespräch. Durch die Fenster unscharf festliche Lichter des Markts. Warmes goldenes Licht, edle Stimmung, keine Schrift, keine Logos.

Ablage: `/assets/hero-16x9.*`, `/assets/hero-4x5.*`. Bis dahin grafischer Hero (Nachtschwarz, Goldlicht-Verlauf, Lichterkette, Schnee).

---

## 6. Bauphasen und Abnahme

Nach jeder Phase: Zusammenfassung + Testanleitung, Freigabe abwarten.

### Phase 0 – Grundgerüst

Vite/React/TS/Tailwind-Setup, Design-Tokens, Fonts, ESLint/Prettier, Vitest, Playwright, GitHub Actions (`ci.yml`, `deploy-supabase.yml`), Supabase-CLI-Struktur, Assets aus den Webseiten in `/assets`, Anleitung Cloudflare Pages + Secrets (`docs/SETUP.md`).

- [ ] `npm run dev`, `npm run build`, `npm test` laufen
- [ ] CI ist grün
- [ ] Cloudflare-Vorschau-URL lädt (noindex)

### Phase 1 – Design und One-Pager

Alle Abschnitte, Texte, Animationen, Buchungs-UI mit Beispieldaten, mobile Leiste, Meta.

- [ ] iPhone, Android, Desktop: lesbar, kein seitliches Scrollen
- [ ] Schnee und Lichterkette flüssig; mit „Bewegung reduzieren“ aus
- [ ] Alle Buttons und Anker springen richtig
- [ ] Texte: Du-Form, 178,50 € groß, Zeiten korrekt, kein „Kaminfeuer“
- [ ] Händler-Logo auf Creme-Plakette, Originalfarben
- [ ] Lighthouse mobil ≥ 85

### Phase 2 – Datenbank, Verfügbarkeit, Tracking

Migrations (Tabellen, RLS, Funktionen, Seeds, pg_cron für Holds), Kalender an `get_availability`, Settings dynamisch, Tracking.

- [ ] Kalender zeigt nur Saisontage
- [ ] Buchung `paid` im Table Editor → Zeitfenster belegt
- [ ] closed_dates-Eintrag → Tag geschlossen
- [ ] Zeitfenster < 60 min vor Beginn nicht buchbar
- [ ] page_events füllt sich, keine Cookies/localStorage-IDs
- [ ] pgTAP: anon kann bookings nicht lesen; Doppel-Insert scheitert

### Phase 3 – Formular und Stripe

`create-checkout`, `stripe-webhook`, `release-hold`, Erfolgsseite, `send-ticket`-Stub.

- [ ] Webhook im Stripe-Dashboard (Test) angelegt, Secret gesetzt
- [ ] Testkarte 4242… → `paid`, Zeitfenster belegt
- [ ] „Zurück“ bei Stripe → Zeitfenster sofort frei
- [ ] Zwei Browser, gleiches Zeitfenster → nur einer kommt zu Stripe
- [ ] Mit Firma → Stripe-Rechnung mit MF Coaching als Absender, USt-ID übernommen
- [ ] Ohne Firma/Häkchen → keine Rechnung
- [ ] Nur Karte/Wallets/PayPal angeboten
- [ ] Playwright-Klicktest läuft in CI

### Phase 4 – Ticket und Brevo

`send-ticket` (QR, PDF, Mail, Kontakte, DOI), `send-reminders`, `/ticket/[token]`, `/newsletter/bestaetigt`, email_log.

- [ ] Mail in Gmail, Outlook, iPhone-Mail, nicht im Spam, PDF im Anhang, QR scanbar
- [ ] „Ticket online öffnen“ funktioniert
- [ ] Kontakt in „Lounge-Buchungen“, nicht im Newsletter
- [ ] Mit Newsletter-Häkchen → DOI-Mail → nach Klick in Newsletter-Liste
- [ ] Erinnerung um 10:00 Berlin genau einmal (Test mit Buchung für heute)
- [ ] email_log zeigt alle Versuche

### Phase 5 – Login und Admin

Login, MFA, alle Admin-Seiten (4.7), Tagesliste-PDF, Anonymisierung.

- [ ] Admin-Login nur mit 2FA
- [ ] Kennzahlen plausibel
- [ ] Manuelle Buchung → Ticket-Mail; Override-Warnung erscheint
- [ ] Zeitfenster sperren → online nicht buchbar
- [ ] Preis ändern → neue Buchungen neu, alte unverändert
- [ ] Händler einladen → Einladungsmail
- [ ] CSV in Excel mit korrekten Umlauten; Tagesliste-PDF druckbar
- [ ] Privates Fenster ohne Login: /admin gesperrt

### Phase 6 – Scanner

- [ ] PIN im Admin setzen, /scan auf dem Handy
- [ ] Gültig → grün + Taler-Button
- [ ] Erneut → gelb
- [ ] Anderer Tag/Zeitfenster → orange, „Trotzdem einchecken“
- [ ] Erfundener Code → rot
- [ ] 5 falsche PINs → 10 min Sperre
- [ ] Flugmodus: Liste „Heute“ sichtbar, Check-in wird nach Netzrückkehr nachgetragen
- [ ] Abends mit Taschenlampe testen
- [ ] PIN ändern → Scanner abgemeldet

### Phase 7 – Händler-Bereich und Abrechnung

- [ ] Händler-Testzugang einloggen
- [ ] Keine E-Mail, Telefon, Adresse, Wünsche, keine Aktions-Buttons
- [ ] /admin und /scan gesperrt
- [ ] Rechenprobe: 3 Buchungen (erschienen, nicht erschienen, storniert) → 275,00 €
- [ ] PDF und CSV prüfen (auch im Admin)

### Phase 8 – Recht, SEO, Barrierefreiheit, Feinschliff

`/impressum`, `/datenschutz`, `/agb` mit Vermerk „Entwurf – noch nicht freigegeben“ und Platzhaltern; schema.org Product/Offer (178,50 EUR); noindex für /admin, /haendler, /scan, /ticket, /buchung, /newsletter, /login; robots.txt + sitemap.xml; WCAG AA; WebP/AVIF; 404-Seite; freundliche Fehlermeldungen; Testdaten-Reset-Skript; `LIVE-SCHALTUNG.md`.

- [ ] Lighthouse mobil ≥ 85 in allen Kategorien
- [ ] Tastaturbedienung von Kalender und Formular
- [ ] Gold auf Schwarz erfüllt AA

### Gesamttest vor dem Start

- [ ] Anwalt prüft Impressum, AGB, Datenschutz → Entwurfs-Vermerk entfernen
- [ ] Steuerberater: Steuersätze, Ausweis der Taler → Tax-Rate-Secrets setzen
- [ ] Testdaten löschen (Reset-Skript)
- [ ] Stripe Live-Schlüssel + Live-Webhook
- [ ] Echte Buchung mit echter Karte, danach stornieren + erstatten
- [ ] Probelauf am Markt: Licht, Netz, Taler-Übergabe
- [ ] Händler-Zugänge + Einweisung
- [ ] Supabase-Auth-Mails über Brevo-SMTP

---

## 7. Datenschutz-Eckpunkte (für Entwurf)

- Verantwortlicher: MF Coaching & Promotion GmbH (betreibt auch STUDIO/F).
- Auftragsverarbeiter: Supabase (EU, Frankfurt), Stripe, Brevo, Hosting [Mittwald], Vorschau Cloudflare (nur Test).
- Weitergabe an Werbegemeinschaft Detmold e. V.: Name, Firma, Personenzahl, Check-in-Status zur Durchführung und Abrechnung.
- Tracking ohne Cookies und ohne personenbezogene Daten.
- Speicherdauer: Kontaktdaten bis 31. März nach der Saison, danach anonymisiert. Rechnungsdaten in Stripe gemäß gesetzlicher Aufbewahrung.
- Scanner: IP nur gehasht, Löschung nach 24 h.

---

## 8. Offene Platzhalter

- [ ] Saison 2026 und Schließtage (aktuell 26.11.–23.12.2026)
- [ ] Genaue Position der Lounge `[GENAUE POSITION]`
- [x] Händler-Rot: `#CD131C` (aus dem Logo-Schriftzug gemessen; Signet-Quadrat `#CD2027`)
- [ ] KI-Bilder (Prompt in Abschnitt 5), später echte Fotos
- [ ] Impressum MF Coaching: Adresse, Registergericht, HRB, Geschäftsführer, USt-ID
- [ ] Steuersätze und Ausweis der Taler (Steuerberater)
- [ ] AGB und Datenschutz (Anwalt)
- [ ] E-Mail-Adressen der Händler-Zugänge
- [ ] Domain (mit den Händlern in Klärung)
- [ ] Netzempfang am Lounge-Standort
- [ ] Freigabe der Du-Ansprache durch die Werbegemeinschaft (deren Website nutzt „Sie“)
- [ ] PayPal im Stripe-Konto aktivieren
