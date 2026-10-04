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

1. **Authentication → Sign In / Providers:** Unter „User Signups“ den Schalter **„Allow new users to sign up“ aus**. Den Anbieter **„Email“ selbst eingeschaltet lassen** – sonst funktioniert auch die Anmeldung nicht.
2. **Authentication → Multi-Factor:** TOTP (Authenticator App) **aktiviert**.
3. **Authentication → URL Configuration:**
   - Site URL: die Cloudflare-URL (später die Live-Domain)
   - Redirect URLs: `http://localhost:5173/**`, `https://*.weihnachtsmarkt-lounge.pages.dev/**`, die Cloudflare-URL mit `/**`
   - Einladungen und „Passwort vergessen“ führen auf `/login/neues-passwort` – das deckt `/**` ab.
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

## 10. Login und Admin (ab Phase 5)

### 10.1 E-Mail-Versand für Einladungen (SMTP)

Der eingebaute Mailversand von Supabase schickt nur an Mitglieder des Supabase-Teams und
höchstens wenige Mails pro Stunde. Für Einladungen an die Händler deshalb Brevo als SMTP eintragen:

**Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP**

- Host `smtp-relay.brevo.com`, Port `587`
- Benutzer und Passwort: aus **Brevo → SMTP & API → SMTP** (eigener SMTP-Schlüssel, nicht der API-Key)
- Absender: `tickets@studio-f.club` (oder die verifizierte Absenderadresse), Name „Lounge der Händler“

### 10.2 Deutsche Texte für die Auth-Mails

**Supabase → Authentication → Emails → Templates.** Vorschlag:

- **Invite user** – Betreff: `Dein Zugang zur Lounge der Händler`
  ```html
  <p>Hallo,</p>
  <p>Studio F hat dir einen Zugang zum Buchungssystem der Weihnachtsmarkt-Lounge eingerichtet.</p>
  <p><a href="{{ .ConfirmationURL }}">Jetzt Passwort festlegen</a></p>
  <p>Der Link ist 24 Stunden gültig.</p>
  ```
- **Reset password** – Betreff: `Neues Passwort für die Lounge der Händler`
  ```html
  <p>Hallo,</p>
  <p>Über diesen Link legst du ein neues Passwort fest:</p>
  <p><a href="{{ .ConfirmationURL }}">Neues Passwort festlegen</a></p>
  <p>Wenn du das nicht angefordert hast, ignoriere diese E-Mail einfach.</p>
  ```

### 10.3 Ersten Admin anlegen (einmalig)

1. **Supabase → Authentication → Users → Add user → Send invitation** an `louis@tanzschule-fricke.de`.
2. **SQL Editor** – Rolle vergeben:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'studio_admin' from auth.users where email = 'louis@tanzschule-fricke.de'
   on conflict do nothing;
   ```
3. Link aus der Einladungsmail öffnen → Passwort festlegen → Authenticator-App einrichten
   (z. B. Google Authenticator, 1Password) → fertig. Alle weiteren Zugänge vergibst du im
   Admin unter **Zugänge**.

**2FA-Gerät verloren?** Im Supabase-SQL-Editor den Faktor löschen:
`delete from auth.mfa_factors where user_id = (select id from auth.users where email = '…');`
Danach richtet man 2FA beim nächsten Login neu ein.
Tipp: Den Schlüssel bei der Einrichtung zusätzlich im Passwort-Manager sichern.

## 11. Apple Wallet und Google Wallet (optional, empfohlen)

Ohne diese Schritte gibt es PDF-Download und Online-Ticket; die Wallet-Buttons erscheinen
automatisch, sobald die Secrets hinterlegt sind (Website und Mail).

### 11.1 Apple Wallet (Konto: MF Coaching & Promotion GmbH)

1. **Apple Developer Program** als Organisation beitreten (99 $ pro Jahr, D-U-N-S-Nummer nötig):
   developer.apple.com → Account.
2. **Certificates, Identifiers & Profiles → Identifiers → +** → „Pass Type IDs“ →
   Beschreibung „Weihnachtsmarkt-Lounge“, ID `pass.club.studio-f.lounge`.
3. Auf dem Mac in der **Schlüsselbundverwaltung** → Zertifikatsassistent → „Zertifikat einer
   Zertifizierungsinstanz anfordern“ → auf der Festplatte sichern (CSR-Datei).
4. Bei der Pass Type ID **„Create Certificate“** → CSR hochladen → `pass.cer` herunterladen →
   doppelklicken → im Schlüsselbund als `.p12` exportieren (mit Passwort).
5. Apple-Zwischenzertifikat **WWDR G4** von apple.com/certificateauthority herunterladen.
6. Umwandeln (Terminal):
   ```bash
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass-cert.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -out pass-key.pem -legacy   # Passwort vergeben
   openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
7. **Supabase → Edge Functions → Secrets:**

   | Name                      | Wert                                     |
   | ------------------------- | ---------------------------------------- |
   | `APPLE_PASS_TYPE_ID`      | `pass.club.studio-f.lounge`              |
   | `APPLE_TEAM_ID`           | Team-ID (oben rechts im Developer-Konto) |
   | `APPLE_PASS_CERT`         | Inhalt von `pass-cert.pem`               |
   | `APPLE_PASS_KEY`          | Inhalt von `pass-key.pem`                |
   | `APPLE_PASS_KEY_PASSWORD` | Passwort aus Schritt 6                   |
   | `APPLE_WWDR_CERT`         | Inhalt von `wwdr.pem`                    |

   (Mehrzeilige Werte gehen; alternativ base64-kodiert.) Das Zertifikat läuft nach einem Jahr ab –
   rechtzeitig erneuern.

### 11.2 Google Wallet (kostenlos)

1. **pay.google.com/business/console** → Google Wallet API → Issuer-Konto anlegen (Firma: MF Coaching
   & Promotion GmbH). Die **Issuer-ID** notieren.
2. **console.cloud.google.com** → Projekt anlegen → „Google Wallet API“ aktivieren → **Dienstkonto**
   anlegen → Schlüssel als JSON herunterladen.
3. In der Pay & Wallet Console unter **Nutzer** die E-Mail-Adresse des Dienstkontos als Entwickler
   hinzufügen.
4. **Supabase-Secrets:** `GOOGLE_WALLET_ISSUER_ID` (Issuer-ID) und `GOOGLE_WALLET_SERVICE_ACCOUNT`
   (kompletter Inhalt der JSON-Datei).
5. Solange Google das Konto nicht freigegeben hat („Publishing access“ beantragen), können nur
   Test-Nutzer speichern – in der Console unter „Testkonten“ eintragen.

**Datenschutz:** Für Google Wallet übertragen wir nur Termin, Buchungscode, Personenzahl und den
QR-Inhalt – keine Namen oder Kontaktdaten. Für die Datenschutzerklärung vormerken (Apple-Pässe
entstehen auf unserem Server und liegen danach nur auf dem Gerät des Gasts).

**Vor dem Livegang:** Die schwarzen Wallet-Buttons durch die offiziellen Badges
„Zu Apple Wallet hinzufügen“ / „In Google Wallet speichern“ ersetzen (Vorgaben von Apple und Google).
Koordinaten der Lounge für die Sperrbildschirm-Anzeige prüfen: `LOUNGE_COORDINATES` in
`supabase/functions/_shared/walletConfig.ts`.

## 12. Scanner am Einlass (ab Phase 6)

1. **Supabase-Secret** `SCANNER_TOKEN_SECRET`: eine lange Zufallszeichenfolge (z. B. `openssl rand -hex 32`).
   Damit werden die Anmeldungen der Scanner-Handys signiert. Ohne eigenes Secret wird der
   service_role-Schlüssel genutzt – funktioniert, ist aber weniger sauber.
2. Im Admin unter **Einstellungen → Scanner-PIN** eine 6-stellige PIN festlegen.
3. Auf dem Einlass-Handy `https://[DOMAIN]/scan` öffnen, PIN eingeben, Kamera erlauben.
   Tipp: Seite zum Home-Bildschirm hinzufügen. Den Tab während des Einlasses offen lassen –
   Offline-Check-ins liegen nur in diesem Tab, bis sie übertragen sind.
4. Die Anmeldung gilt 12 Stunden. Eine neue PIN meldet alle Geräte sofort ab.

## 13. Fotos der Lounge

Originalfotos in `assets/lounge-fotos/` legen (siehe `LIESMICH.md` dort) und `npm run images`
ausführen – oder mir die Fotos schicken. Die Galerie erscheint erst, wenn Fotos da sind.

## Lokal entwickeln (optional)

Du musst nichts lokal installieren. Wer es trotzdem möchte:

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev                  # http://127.0.0.1:5173
npm test                     # Unit-Tests
npm run test:e2e             # Klicktests (vorher einmal: npx playwright install chromium)
```
