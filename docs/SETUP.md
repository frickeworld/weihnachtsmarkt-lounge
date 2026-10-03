# Einrichtung – Schritt für Schritt

Diese Anleitung brauchst du einmalig. Trage Secrets **nie** in den Chat, in Dateien im Repo oder ins Frontend ein.

Übersicht, was wann gebraucht wird:

| Schritt                        | Wofür                                    | Spätestens vor  |
| ------------------------------ | ---------------------------------------- | --------------- |
| 1. Branch `main` anlegen       | Deployment und Live-Stand                | Phase 2         |
| 2. Cloudflare Pages            | Vorschau zum Klicken                     | jetzt (Phase 1) |
| 3. GitHub-Secrets              | automatisches Supabase-Deployment, Tests | Phase 2         |
| 4. Supabase-Grundeinstellungen | Login, Sicherheit                        | Phase 2         |
| 5. Supabase-Secrets            | Stripe, Brevo, Scanner                   | Phase 3         |
| 6. Stripe                      | Zahlarten, Webhook                       | Phase 3         |
| 7. Brevo                       | Listen, Double-Opt-in                    | Phase 4         |

---

## 1. Branch `main` anlegen

Im Repo gibt es bisher nur den Arbeits-Branch. `main` ist später der Live-Stand: Jeder Push auf `main` spielt Datenbank und Edge Functions ins Supabase-Projekt ein.

1. GitHub → Repo `frickeworld/weihnachtsmarkt-lounge` → **Pull requests** → **New pull request**.
2. Den Arbeits-Branch nach dem Abschluss einer Phase per Pull Request nach `main` mergen. (Ich kann die Pull Requests für dich anlegen, wenn du das möchtest.)
3. Unter **Settings → General → Default branch** `main` als Standard-Branch setzen.

## 2. Cloudflare Pages (Vorschau)

1. Auf <https://dash.cloudflare.com> anmelden (kostenloses Konto reicht).
2. **Workers & Pages → Create → Pages → Connect to Git** → GitHub verbinden → Repo `weihnachtsmarkt-lounge` wählen.
3. Build-Einstellungen:
   - Framework preset: **Vite** (bzw. „None“)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Production branch: `main`
4. **Environment variables** (für Production und Preview):
   - `NODE_VERSION` = `22`
   - `VITE_NOINDEX` = `true` (die Vorschau soll nicht bei Google landen)
   - `VITE_PUBLIC_SITE_URL` = die Cloudflare-URL, z. B. `https://weihnachtsmarkt-lounge.pages.dev`
   - ab Phase 2: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (siehe Schritt 3)
5. **Branch-Vorschauen:** Settings → Builds → Preview deployments → „All non-Production branches“. Jeder Branch bekommt dann eine eigene URL.
6. **SPA-Routing:** Cloudflare Pages leitet unbekannte Pfade bei einer Single-Page-App automatisch auf `index.html`. Nichts weiter nötig.

## 3. GitHub-Secrets

GitHub → Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name                     | Wo finde ich das?                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`  | supabase.com → Avatar oben rechts → **Account preferences → Access Tokens** → „Generate new token“ (Name z. B. `github-weihnachtsmarkt-lounge`) |
| `SUPABASE_PROJECT_REF`   | Supabase-Projekt → **Project Settings → General → Project ID** (z. B. `abcdefghijklmnop`)                                                       |
| `SUPABASE_DB_PASSWORD`   | das Datenbank-Passwort vom Anlegen des Projekts (falls verloren: Project Settings → Database → Reset database password)                         |
| `VITE_SUPABASE_URL`      | Project Settings → **API** → Project URL                                                                                                        |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → **API** → `anon` `public` Key (dieser Key ist öffentlich und darf ins Frontend)                                              |

Ab Phase 3 kommt `STRIPE_TEST_SECRET_KEY` für den automatischen Klicktest dazu.

**Niemals** den `service_role`-Key irgendwo eintragen außer dort, wo ich ausdrücklich darum bitte.

## 4. Supabase-Grundeinstellungen (Dashboard)

1. **Authentication → Sign In / Providers → Email:** „Allow new users to sign up“ **aus**.
2. **Authentication → Multi-Factor:** TOTP (Authenticator App) **aktiviert**.
3. **Authentication → URL Configuration:**
   - Site URL: die Cloudflare-URL (später die Live-Domain)
   - Redirect URLs: `http://localhost:5173/**`, `https://*.weihnachtsmarkt-lounge.pages.dev/**`, die Cloudflare-URL mit `/**`
4. **Database → Extensions:** `pg_cron` und `pg_net` aktivieren (brauchen wir ab Phase 2 für Reservierungs-Ablauf und Erinnerungsmails). Falls es nicht klappt: Ich mache es per Migration.

## 5. Supabase-Secrets (ab Phase 3)

Supabase → **Edge Functions → Secrets** (oder Project Settings → Edge Functions):

| Name                    | Wert                                                                          |
| ----------------------- | ----------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe Testmodus → Entwickler → API-Schlüssel → Geheimschlüssel (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | kommt in Phase 3 (`whsec_…`)                                                  |
| `BREVO_API_KEY`         | Brevo → SMTP & API → API-Schlüssel (v3)                                       |
| `BREVO_SENDER_EMAIL`    | z. B. `tickets@studio-f.club`                                                 |
| `BREVO_SENDER_NAME`     | `Weihnachtsmarkt-Lounge der Händler`                                          |
| `BREVO_LIST_BOOKINGS`   | ID der Liste „Lounge-Buchungen 2026“                                          |
| `BREVO_LIST_NEWSLETTER` | ID der Newsletter-Liste                                                       |
| `BREVO_DOI_TEMPLATE_ID` | ID der Double-Opt-in-Vorlage                                                  |
| `PUBLIC_SITE_URL`       | die Cloudflare-URL (später die Live-Domain), ohne `/` am Ende                 |
| `SCANNER_TOKEN_SECRET`  | lange Zufallszeichenkette – ich sage dir in Phase 6, wie du sie erzeugst      |
| `CRON_SECRET`           | lange Zufallszeichenkette für die Erinnerungsmails, siehe Abschnitt 8         |

## 6. Stripe (Konto MF Coaching & Promotion GmbH)

1. **Einstellungen → Zahlungen → Zahlungsmethoden:** Karte, Apple Pay, Google Pay und **PayPal** aktiv. SEPA-Lastschrift, Klarna, Sofort/Überweisung brauchen wir nicht (die Seite fordert sie ohnehin nicht an).
2. **Einstellungen → Unternehmensdetails / Branding / Rechnungen:** Firmendaten, Logo, Rechnungsnummernkreis pflegen.
3. **Webhook anlegen (Testmodus):** Entwickler → Webhooks → **Endpunkt hinzufügen**
   - URL: `https://[PROJEKT-REF].supabase.co/functions/v1/stripe-webhook`
   - Ereignisse: `checkout.session.completed`, `checkout.session.expired`,
     `checkout.session.async_payment_succeeded`, `invoice.finalized`
   - Danach das **Signing Secret** (`whsec_…`) kopieren und in Supabase als `STRIPE_WEBHOOK_SECRET` eintragen.
4. Prüfen, ob Stripe für automatische Rechnungen (Invoicing) eine Gebühr berechnet – Rechnungen entstehen
   nur bei Firmenbuchungen oder Rechnungswunsch.

Optionale Supabase-Secrets für Stripe:

| Name                          | Wert                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `STRIPE_PAYMENT_METHOD_TYPES` | Standard `card,paypal`. Nur falls PayPal (noch) nicht aktiv ist: `card`                   |
| `STRIPE_TAX_RATE_LOUNGE`      | Steuersatz-ID (`txr_…`) für die Lounge-Position – erst nach Rücksprache mit Steuerberater |
| `STRIPE_TAX_RATE_FEE`         | Steuersatz-ID für die Vorverkaufsgebühr                                                   |

## 7. Brevo

1. Liste „Lounge-Buchungen 2026“ anlegen, ID notieren.
2. ID der Newsletter-Liste notieren.
3. Double-Opt-in-Vorlage anlegen, Template-ID notieren.
4. Kontakt-Attribute prüfen: heißen sie `VORNAME`/`NACHNAME` oder `FIRSTNAME`/`LASTNAME`? Attribut `FIRMA` ggf. anlegen.
   Standard ist `VORNAME`/`NACHNAME`/`FIRMA`. Weichen die Namen ab, die Secrets `BREVO_ATTR_FIRSTNAME`,
   `BREVO_ATTR_LASTNAME` bzw. `BREVO_ATTR_COMPANY` setzen (z. B. `FIRSTNAME`).
5. Double-Opt-in-Vorlage: Als Ziel nach der Bestätigung trägt die Seite automatisch
   `[PUBLIC_SITE_URL]/newsletter/bestaetigt` ein.
6. Absender `tickets@studio-f.club` (oder ähnlich) unter **Absender & IP** anlegen; die Domain studio-f.club muss
   mit SPF und DKIM verifiziert sein, sonst landen Tickets im Spam.

## 8. Erinnerungsmails (Zeitplan)

Die Datenbank ruft alle 15 Minuten die Function `send-reminders` auf (ab 10:00 Uhr am Buchungstag wird verschickt).
Dafür braucht sie die Projekt-URL und ein Geheimnis – beides liegt verschlüsselt im Supabase Vault.

1. Ein langes Zufalls-Geheimnis erzeugen, z. B. im Terminal: `openssl rand -hex 32`
   (oder einen Passwort-Generator mit 64 Zeichen nutzen).
2. In Supabase unter **Edge Functions → Secrets** als `CRON_SECRET` eintragen.
3. Im **SQL Editor** einmalig ausführen (Werte ersetzen):

```sql
select vault.create_secret('https://[PROJEKT-REF].supabase.co', 'project_url');
select vault.create_secret('[DEIN-CRON-SECRET]', 'cron_secret');
```

Fehlen diese Einträge, passiert einfach nichts (keine Fehler, aber auch keine Erinnerungen).

## 9. Stripe-Rechnungen per Mail

In Stripe unter **Einstellungen → Billing → Rechnungen → Kunden-E-Mails** „Abgeschlossene Rechnungen an
Kunden senden“ aktivieren. Dann bekommt der Gast die Rechnung zusätzlich direkt von Stripe – auch wenn sie
erst nach der Ticket-Mail fertig ist.

---

## Lokal entwickeln (optional)

Du musst nichts lokal installieren. Wer es trotzdem möchte:

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev                  # http://127.0.0.1:5173
npm test                     # Unit-Tests
npm run test:e2e             # Klicktests (vorher einmal: npx playwright install chromium)
```
