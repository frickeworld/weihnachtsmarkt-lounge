# Live bei Mittwald (mStudio): die Buchungsseite auf einer Studio-F-Subdomain

Entscheidung Louis (04.11.2026): Die Buchungsseite läuft auf einer eigenen Subdomain von
studio-f.club, z. B. **`https://weihnachtslounge.studio-f.club`**, in einem **eigenen mStudio-Projekt** auf
dem bestehenden Space-Server „Sen-Yoga“ (Ressourcen werden geteilt, kein neuer Tarif).
Die Studio-F-Website (studio-f.club im alten Kundencenter, Tarif p346507) wird **nicht
verändert** – dort kommt nur ein DNS-Eintrag für die Subdomain dazu.

Bei Mittwald liegen nur die Dateien der Seite (statischer Build). Datenbank, Zahlung und Mails
laufen über Supabase, Stripe und Brevo. Die Infoseite des Weihnachtsmarkts (Tom, WordPress)
verlinkt mit „Lounge buchen“ auf die Subdomain.

```
studio-f.club (altes Kundencenter, p346507)    ← bleibt unverändert
  └─ neuer DNS-Eintrag: weihnachtslounge.studio-f.club → mStudio

mStudio, Server „Sen-Yoga“ (s-m4iw49)
  ├─ Projekt „Sen-Yoga Website“                 ← unverändert
  └─ Projekt „Studio F – Weihnachtsmarkt-Lounge“
        ├─ App „PHP – Eigene App“ in /html/weihnachtslounge   (Apache, liest unsere .htaccess)
        ├─ Domain weihnachtslounge.studio-f.club → App, SSL automatisch (Let's Encrypt)
        └─ SFTP-Zugang ──► GitHub lädt bei jedem Push auf main hoch
```

Der Upload (`scripts/deploy-sftp.sh`, GitHub Action „Deploy Website (Mittwald)“) löscht nie
etwas, lädt `.htaccess` und `index.html` zuletzt hoch und bricht ab, wenn im Zielordner eine
WordPress-Installation liegt, das Ziel das Hauptverzeichnis ist oder der Build für eine andere
Adresse gebaut wurde. Ohne hinterlegten Zugang wird er übersprungen (kein Fehler).

---

## 1. Subdomain im alten Kundencenter (studio-f.club)

Nur **einen** neuen Eintrag für `weihnachtslounge` anlegen. Bestehende Einträge (`@`, `www`, MX für
E-Mail, `_dmarc`, DKIM, andere Subdomains) **nicht anfassen**.

1. Kundencenter → Tarif **Webhosting L 10.0 (p346507)** → **Domains** → bei `studio-f.club`
   **Subdomain anlegen**: `weihnachtslounge`. Ziel/Ordner ist egal (die Seite liegt nicht hier).
2. **DNS-Editor** → `weihnachtslounge.studio-f.club` → eigene Einträge setzen:
   - **A-Record:** IPv4 der mStudio-Projektdomain (steht im mStudio bei der Domain bzw.
     `p-…project.space`; für den Server „Sen-Yoga“ derzeit `185.215.158.107`)
   - **Kein AAAA-Record** (IPv6 aus lassen): mStudio stellt das SSL-Zertifikat sonst nicht aus.
   - **TXT-Eintrag** `domainVerification=…` aus mStudio (Domain → „Domain nicht verifiziert“)
     ebenfalls bei `weihnachtslounge` anlegen, dann in mStudio „Verifizierung starten“.
3. Wirkt meist nach wenigen Minuten, spätestens nach einigen Stunden.

## 2. mStudio

1. **Projekt anlegen** auf Server „Sen-Yoga“: Name `Studio F – Weihnachtsmarkt-Lounge`
   („Anlegen“, nicht „Tarifauswahl öffnen“).
2. **App installieren:** **„PHP – Eigene App“** (nicht „PHP-Worker“, nicht WordPress),
   Name `Weihnachtsmarkt-Lounge`, Installationsverzeichnis `weihnachtslounge` → `/html/weihnachtslounge`,
   PHP-Version wie vorgeschlagen. Eine Platzhalter-`index.php` darf liegen bleiben
   (unsere `.htaccess` setzt `index.html` als Startseite); löschen schadet auch nicht.
3. **Domain:** Domains → Hinzufügen → **„vHost einrichten“** (nicht „Domain umziehen“!) →
   `weihnachtslounge.studio-f.club`, Ziel: App `weihnachtslounge`. SSL-Zertifikat
   (Let's Encrypt) erstellt mStudio automatisch, sobald der DNS-Eintrag wirkt.
4. **SFTP-Zugang** im Projekt anlegen (Passwort). Notieren: Server (Host), Benutzername, Pfad
   der App (`/html/weihnachtslounge`). Die genauen Verbindungsdaten zeigt mStudio beim Benutzer an.

## 3. GitHub (Repository → Settings → Secrets and variables → Actions → Secrets)

| Name                     | Wert                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `VITE_PUBLIC_SITE_URL`   | `https://weihnachtslounge.studio-f.club` (vorhandenen Eintrag ändern) |
| `DEPLOY_SFTP_HOST`       | SFTP-Server aus mStudio                                               |
| `DEPLOY_SFTP_USER`       | SFTP-Benutzer aus mStudio                                             |
| `DEPLOY_SFTP_PASSWORD`   | Passwort dazu                                                         |
| `DEPLOY_TARGET_DIR`      | `/html/weihnachtslounge` (bzw. der Pfad, wie ihn SFTP anzeigt)        |
| `DEPLOY_SSH_KNOWN_HOSTS` | optional: Ausgabe von `ssh-keyscan <SFTP-Server>`                     |
| `VITE_NOINDEX`           | `false`, sobald Suchmaschinen die Seite finden sollen                 |

`VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` sind schon hinterlegt.

Danach unter **Actions → Deploy Website (Mittwald) → Run workflow** den ersten Upload starten.
Später läuft er bei jedem Push auf `main` automatisch.

## 4. Supabase (mit der neuen Adresse)

- **Edge Functions → Secrets:** `PUBLIC_SITE_URL` = `https://weihnachtslounge.studio-f.club`
- **Authentication → URL Configuration:** Site URL `https://weihnachtslounge.studio-f.club`,
  Redirect URL `https://weihnachtslounge.studio-f.club/**`

## 5. Links für Toms Infoseite

| Wofür                              | Link                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| Buttons „Lounge buchen“            | `https://weihnachtslounge.studio-f.club/#buchen`                  |
| Bestimmter Tag vorausgewählt       | `https://weihnachtslounge.studio-f.club/?datum=2026-12-22#buchen` |
| Besondere Termine (Partys, 24.12.) | `https://weihnachtslounge.studio-f.club/#besondere-abende`        |

## 6. Prüfen nach dem ersten Upload

- `https://studio-f.club` zeigt weiter die Studio-F-Seite (unverändert).
- `https://weihnachtslounge.studio-f.club/` zeigt die Buchungsseite, `http://` leitet auf `https://` um.
- Direktlinks `…/agb` und `…/ticket/irgendwas` laden die Seite (keine 404-Seite von Mittwald).
- `…/admin` leitet zum Login.
- Danach Abnahme aus `LIVE-SCHALTUNG.md` (Abschnitt E) mit echter Testbuchung.

## 7. Notfall: von Hand hochladen

```bash
VITE_SUPABASE_URL=https://[PROJEKT-REF].supabase.co \
VITE_SUPABASE_ANON_KEY=[ANON-KEY] \
VITE_PUBLIC_SITE_URL=https://weihnachtslounge.studio-f.club \
VITE_NOINDEX=false \
npm run build
```

Dann den **Inhalt** von `dist/` (inkl. der versteckten `.htaccess`) per SFTP, z. B. mit
FileZilla, nach `/html/weihnachtslounge` hochladen – oder mit denselben Werten wie in Schritt 3
`bash scripts/deploy-sftp.sh` ausführen.

## Datenschutz

Hosting-Anbieter ist Mittwald CM Service GmbH & Co. KG (Espelkamp). Zu klären: Wer ist
Inhaber des mStudio-Kontos mit dem Server „Sen-Yoga“, und besteht dafür ein Vertrag zur
Auftragsverarbeitung (Mittwald-AV-Manager), der auch die Lounge abdeckt? Verantwortlicher für
die Lounge ist die MF Coaching & Promotion GmbH. Die Speicherdauer der Server-Logs ist in der Datenschutzerklärung noch
einzutragen.
