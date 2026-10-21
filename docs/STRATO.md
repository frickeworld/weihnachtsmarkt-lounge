# Live bei Strato: die Lounge als Unterordner neben WordPress

Entscheidung Louis (21.10.2026): Die Lounge-Seite liegt auf derselben Domain wie die
WordPress-Seite des Weihnachtsmarkts, im Unterordner **`/lounge`**, z. B.
`https://weihnachtsmarkt-detmold.de/lounge`. Bei Strato liegen nur die Dateien der Seite.
Datenbank, Zahlung und Mails laufen weiter über Supabase, Stripe und Brevo.

```
Strato-Webspace (Ordner der Domain)
├── .htaccess          ← WordPress (bleibt unverändert)
├── index.php, wp-…    ← WordPress
└── lounge/            ← unsere Seite (eigene .htaccess, wird automatisch hochgeladen)
    ├── .htaccess
    ├── index.html
    ├── assets/ …
    └── email/, wallet/, favicon.png, og-image.png, robots.txt, sitemap.xml
```

WordPress wird dabei nicht verändert. Die `.htaccess` im Ordner `lounge/` gilt nur für diesen
Ordner. Der Upload löscht nie etwas. Er verweigert den Start, wenn der Zielordner nicht auf
`/lounge` endet.

Wie der Aufbau funktioniert, prüft die CI bei jedem Push mit einem echten Apache und einer
WordPress-`.htaccess` (`scripts/apache-subfolder-test.sh`). Den Upload prüft sie per SFTP gegen
einen Testserver.

---

## 1. Bei Strato (wer den Strato-Zugang hat)

1. **SFTP-Zugang anlegen:** im Strato-Kundenlogin unter dem Hosting-Paket, Bereich
   SFTP/SSH-Zugänge. Am besten einen eigenen Benutzer nur für die Lounge anlegen. Notieren:
   - Server (bei Strato meist `ssh.strato.de`, bitte im Kundenlogin nachsehen)
   - Benutzername und Passwort
2. **Ordner der Domain herausfinden:** Im Kundenlogin unter Domains steht, auf welchen Ordner
   die Domain zeigt. Das ist der Ordner, in dem WordPress liegt (z. B. `/` oder `/wordpress`).
   Zielordner für die Lounge ist dieser Ordner plus `/lounge`, also z. B. `/lounge` oder
   `/wordpress/lounge`.
3. **SSL (https)** für die Domain muss aktiv sein. Stripe, Apple Wallet und Google Wallet
   brauchen https.
4. **Umzug von WordPress:** Der Ordner `lounge/` kann vor oder nach dem Umzug hochgeladen werden.
   Wichtig ist nur, dass er im Ordner der Domain liegt. Wird WordPress in einen anderen Ordner
   verschoben, muss `STRATO_TARGET_DIR` (Schritt 2) angepasst werden.

> Zugangsdaten nie per Mail, Chat oder ins Repository. Sie werden nur als GitHub-Secret
> hinterlegt (Schritt 2).

## 2. In GitHub (Repository → Settings → Secrets and variables → Actions)

**Variables** (öffentliche Werte):

| Name                     | Wert                                           |
| ------------------------ | ---------------------------------------------- |
| `VITE_PUBLIC_SITE_URL`   | `https://weihnachtsmarkt-detmold.de/lounge`    |
| `VITE_SUPABASE_URL`      | `https://[PROJEKT-REF].supabase.co`            |
| `VITE_SUPABASE_ANON_KEY` | Anon Key aus Supabase → Project Settings → API |
| `VITE_NOINDEX`           | `false` (erst beim Livegang, vorher `true`)    |

**Secrets:**

| Name                     | Wert                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `STRATO_SFTP_HOST`       | z. B. `ssh.strato.de`                                                               |
| `STRATO_SFTP_USER`       | SFTP-Benutzer aus Schritt 1                                                         |
| `STRATO_SFTP_PASSWORD`   | Passwort dazu                                                                       |
| `STRATO_TARGET_DIR`      | Zielordner aus Schritt 1, z. B. `/lounge` oder `/wordpress/lounge`                  |
| `STRATO_SSH_KNOWN_HOSTS` | empfohlen: Ausgabe von `ssh-keyscan ssh.strato.de` (schützt vor gefälschtem Server) |

Danach lädt die Action **„Deploy Website (Strato)“** (`.github/workflows/deploy-site.yml`)
bei jedem Push auf `main` die Seite hoch. Vorher laufen Lint, Typecheck und Tests. Von Hand
startet man sie unter Actions → Deploy Website (Strato) → Run workflow.

## 3. Supabase (einmalig, mit der Live-Adresse)

- **Edge-Function-Secret** `PUBLIC_SITE_URL` = `https://weihnachtsmarkt-detmold.de/lounge`
  (ohne `/` am Ende). Daraus entstehen alle Links in Mails, Tickets, Wallet und Stripe.
- **Authentication → URL Configuration:**
  - Site URL: `https://weihnachtsmarkt-detmold.de/lounge`
  - Redirect URLs zusätzlich: `https://weihnachtsmarkt-detmold.de/lounge/**`

Stripe braucht keine Änderung. Stripe Checkout läuft auf stripe.com, die Rücksprung-Adressen
kommen aus `PUBLIC_SITE_URL`. Eine Apple-Pay-Domain-Verifizierung ist bei Stripe Checkout
nicht nötig.

## 4. In WordPress

1. **Menüpunkt oder Button „Lounge buchen“** mit dem Link `/lounge/` anlegen.
2. **robots.txt der Hauptseite:** Suchmaschinen lesen die robots.txt nur im Hauptverzeichnis.
   Dort (z. B. mit Yoast → Werkzeuge → Datei-Editor) ergänzen:
   ```
   Disallow: /lounge/admin
   Disallow: /lounge/haendler
   Disallow: /lounge/scan
   Disallow: /lounge/ticket
   Disallow: /lounge/buchung
   Disallow: /lounge/newsletter
   Disallow: /lounge/login
   Sitemap: https://weihnachtsmarkt-detmold.de/lounge/sitemap.xml
   ```
   Die internen Bereiche sind auch ohne diese Zeilen geschützt (`X-Robots-Tag: noindex` und
   Login), die Zeilen sparen nur unnötige Zugriffe von Suchmaschinen.
3. **Plugins für Cache und Sicherheit** (z. B. WP Rocket, W3 Total Cache, Wordfence): Falls
   sie eigene Regeln in die `.htaccess` schreiben, den Pfad `/lounge` ausnehmen. Normalerweise
   greifen sie für den Ordner nicht.
4. **Cookie-Banner und Tracking von WordPress** laufen auf `/lounge` nicht mit. Die Lounge setzt
   keine Cookies und lädt keine fremden Skripte.
5. In der **Google Search Console** die Sitemap `/lounge/sitemap.xml` einreichen.

## 5. Prüfen nach dem ersten Upload

- `https://weihnachtsmarkt-detmold.de/` zeigt weiter WordPress.
- `https://weihnachtsmarkt-detmold.de/lounge/` zeigt die Lounge.
- Direktlink `https://weihnachtsmarkt-detmold.de/lounge/agb` lädt (nicht die WordPress-404-Seite).
- `https://weihnachtsmarkt-detmold.de/lounge/admin` leitet zum Login.
- `http://…/lounge/` leitet auf `https://` um.
- Danach die Abnahme aus `LIVE-SCHALTUNG.md` (Abschnitt E).

## 6. Notfall: von Hand hochladen

Falls die Action nicht läuft, auf dem eigenen Rechner:

```bash
VITE_SUPABASE_URL=https://[PROJEKT-REF].supabase.co \
VITE_SUPABASE_ANON_KEY=[ANON-KEY] \
VITE_PUBLIC_SITE_URL=https://weihnachtsmarkt-detmold.de/lounge \
VITE_NOINDEX=false \
npm run build
```

Dann den **Inhalt** von `dist/` in den Ordner `lounge/` hochladen, z. B. mit FileZilla über SFTP.
Die versteckte Datei `.htaccess` gehört dazu. Oder mit denselben Werten wie in Schritt 2
`bash scripts/deploy-strato.sh` ausführen.

## Offen für den Anwalt bzw. Datenschutz

- Hosting-Anbieter ist jetzt **Strato**. Wer ist Vertragspartner von Strato? Vermutlich der
  Inhaber der Domain bzw. der WordPress-Seite. Mit wem besteht der Vertrag zur
  Auftragsverarbeitung? Die Datenschutzerklärung (Abschnitt 3) und SPEC 7 sind entsprechend
  angepasst. Die Speicherdauer der Server-Logs bei Strato muss noch eingetragen werden.
