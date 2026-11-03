# Live bei Strato: die Buchungsseite auf einer eigenen Subdomain

Entscheidung Louis (03.11.2026): Die Buchungsseite läuft auf einer eigenen Subdomain der
Weihnachtsmarkt-Domain, z. B. **`https://buchen.weihnachtsmarkt-detmold.de`**. Toms
WordPress-Seite (`weihnachtsmarkt-detmold.de/lounge/`) bleibt die Infoseite. Alle Buttons
„Lounge buchen“ dort verlinken auf die Subdomain. Ein Einbau per iFrame ist nicht vorgesehen,
weil Stripe Checkout (Karte, PayPal, Apple Pay) im eigenen Fenster laufen muss.

Bei Strato liegen nur die Dateien der Seite. Datenbank, Zahlung und Mails laufen weiter über
Supabase, Stripe und Brevo.

```
Strato-Webspace
├── (WordPress-Ordner)   ← weihnachtsmarkt-detmold.de, bleibt unverändert
└── buchen/              ← buchen.weihnachtsmarkt-detmold.de, unsere Seite
    ├── .htaccess
    ├── index.html
    ├── assets/ …
    └── email/, wallet/, favicon.png, og-image.png, robots.txt, sitemap.xml
```

Der Upload löscht nie etwas. Er bricht ab, wenn im Zielordner WordPress oder eine andere Seite
liegt (`wp-config.php`, `wp-content`, `index.php` …), wenn das Hauptverzeichnis als Ziel
angegeben ist oder wenn der Build für eine andere Adresse gebaut wurde.

Der frühere Plan, die Seite als Unterordner `/lounge` neben WordPress zu betreiben, funktioniert
weiterhin (dann `VITE_PUBLIC_SITE_URL` mit Pfad). Die CI prüft ihn mit einem echten Apache
(`scripts/apache-subfolder-test.sh`).

---

## 1. Bei Strato (Tom)

1. **Subdomain anlegen**, z. B. `buchen`, mit **eigenem Ordner**, z. B. `/buchen`. Nicht den
   Ordner von WordPress nehmen.
2. **SSL-Zertifikat (https)** für die Subdomain aktivieren. Stripe und Wallet brauchen https.
3. **SFTP-Zugang** für diesen Ordner anlegen und notieren:
   - Server (bei Strato meist `ssh.strato.de`, bitte im Kundenlogin nachsehen)
   - Benutzername und Passwort
   - Pfad des Ordners, so wie er beim SFTP-Login erscheint (z. B. `/buchen`)

> Die Zugangsdaten werden nur als GitHub-Secret hinterlegt (Schritt 2). Kamen sie per Mail,
> die Mail danach löschen oder das Passwort einmal ändern lassen.

## 2. In GitHub (Repository → Settings → Secrets and variables → Actions)

**Variables** (öffentliche Werte):

| Name                     | Wert                                                 |
| ------------------------ | ---------------------------------------------------- |
| `VITE_PUBLIC_SITE_URL`   | `https://buchen.weihnachtsmarkt-detmold.de`          |
| `VITE_SUPABASE_URL`      | `https://[PROJEKT-REF].supabase.co`                  |
| `VITE_SUPABASE_ANON_KEY` | Anon Key aus Supabase → Project Settings → API       |
| `VITE_NOINDEX`           | `false` (wenn Suchmaschinen die Seite finden sollen) |

**Secrets:**

| Name                     | Wert                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `STRATO_SFTP_HOST`       | z. B. `ssh.strato.de`                                                               |
| `STRATO_SFTP_USER`       | SFTP-Benutzer aus Schritt 1                                                         |
| `STRATO_SFTP_PASSWORD`   | Passwort dazu                                                                       |
| `STRATO_TARGET_DIR`      | Ordner der Subdomain aus Schritt 1, z. B. `/buchen`                                 |
| `STRATO_SSH_KNOWN_HOSTS` | empfohlen: Ausgabe von `ssh-keyscan ssh.strato.de` (schützt vor gefälschtem Server) |

Danach lädt die Action **„Deploy Website (Strato)“** (`.github/workflows/deploy-site.yml`)
bei jedem Push auf `main` die Seite hoch. Vorher laufen Lint, Typecheck und Tests. Schlägt
etwas fehl, wird nichts hochgeladen und die alte Version bleibt online. Von Hand startet man
sie unter Actions → Deploy Website (Strato) → Run workflow.

## 3. Supabase (einmalig, mit der Live-Adresse)

- **Edge-Function-Secret** `PUBLIC_SITE_URL` = `https://buchen.weihnachtsmarkt-detmold.de`
  (ohne `/` am Ende). Daraus entstehen alle Links in Mails, Tickets, Wallet und Stripe.
- **Authentication → URL Configuration:**
  - Site URL: `https://buchen.weihnachtsmarkt-detmold.de`
  - Redirect URLs zusätzlich: `https://buchen.weihnachtsmarkt-detmold.de/**`

Stripe braucht keine eigene Einstellung für die Adresse. Stripe Checkout läuft auf stripe.com,
die Rücksprung-Adressen kommen aus `PUBLIC_SITE_URL`. Eine Apple-Pay-Domain-Verifizierung ist
bei Stripe Checkout nicht nötig.

## 4. Links für Toms WordPress-Seite

| Wofür                              | Link                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| Buttons „Lounge buchen“            | `https://buchen.weihnachtsmarkt-detmold.de/#buchen`                  |
| Bestimmter Tag vorausgewählt       | `https://buchen.weihnachtsmarkt-detmold.de/?datum=2026-12-22#buchen` |
| Besondere Termine (Partys, 24.12.) | `https://buchen.weihnachtsmarkt-detmold.de/#besondere-abende`        |
| Gewinnspiel (wenn aktiv)           | `https://buchen.weihnachtsmarkt-detmold.de/gewinnspiel`              |

Preise und Termine auf der WordPress-Seite sollten nur grob genannt werden („ab 99 €“). Die
genauen Preise, die freien Termine und die Sonderpreise stehen immer aktuell auf der
Buchungsseite.

## 5. Prüfen nach dem ersten Upload

- `https://weihnachtsmarkt-detmold.de/` zeigt weiter WordPress.
- `https://buchen.weihnachtsmarkt-detmold.de/` zeigt die Buchungsseite.
- Direktlink `https://buchen.weihnachtsmarkt-detmold.de/agb` lädt.
- `https://buchen.weihnachtsmarkt-detmold.de/admin` leitet zum Login.
- `http://buchen…` leitet auf `https://` um.
- `https://buchen.weihnachtsmarkt-detmold.de/robots.txt` und `/sitemap.xml` sind erreichbar.
- Danach die Abnahme aus `LIVE-SCHALTUNG.md` (Abschnitt E).

## 6. Notfall: von Hand hochladen

Falls die Action nicht läuft, auf dem eigenen Rechner:

```bash
VITE_SUPABASE_URL=https://[PROJEKT-REF].supabase.co \
VITE_SUPABASE_ANON_KEY=[ANON-KEY] \
VITE_PUBLIC_SITE_URL=https://buchen.weihnachtsmarkt-detmold.de \
VITE_NOINDEX=false \
npm run build
```

Dann den **Inhalt** von `dist/` in den Ordner der Subdomain hochladen, z. B. mit FileZilla über
SFTP. Die versteckte Datei `.htaccess` gehört dazu. Oder mit denselben Werten wie in Schritt 2
`bash scripts/deploy-strato.sh` ausführen.

## Offen für den Anwalt bzw. Datenschutz

- Hosting-Anbieter ist jetzt **Strato**. Wer ist Vertragspartner von Strato? Vermutlich der
  Inhaber der Domain bzw. der WordPress-Seite. Mit wem besteht der Vertrag zur
  Auftragsverarbeitung? Die Datenschutzerklärung (Abschnitt 3) und SPEC 7 sind entsprechend
  angepasst. Die Speicherdauer der Server-Logs bei Strato muss noch eingetragen werden.
