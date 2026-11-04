#!/usr/bin/env bash
# Lädt den fertigen Build (dist/) per SFTP zum Hoster – bei Mittwald mStudio in den Ordner der
# App (z. B. /html/weihnachtslounge für weihnachtslounge.studio-f.club); funktioniert auch für einen Unterordner neben
# einer anderen Seite (z. B. example.de/lounge). Löscht nichts. Reihenfolge: erst alle Dateien,
# zuletzt .htaccess und index.html – so sieht niemand eine halb hochgeladene Seite.
#
# Benötigt: lftp, ssh, node und diese Umgebungsvariablen (nie ins Repo schreiben):
#   DEPLOY_SFTP_HOST, DEPLOY_SFTP_USER, DEPLOY_SFTP_PASSWORD, DEPLOY_TARGET_DIR,
#   VITE_PUBLIC_SITE_URL (dieselbe Adresse wie beim Build)
#   optional DEPLOY_SFTP_PORT (Standard 22), DEPLOY_SSH_KNOWN_HOSTS (Server-Schlüssel)
set -euo pipefail

for v in DEPLOY_SFTP_HOST DEPLOY_SFTP_USER DEPLOY_SFTP_PASSWORD DEPLOY_TARGET_DIR VITE_PUBLIC_SITE_URL; do
  if [ -z "${!v:-}" ]; then echo "Fehlt: $v (siehe docs/MITTWALD.md)" >&2; exit 1; fi
done

# Pfad der Seite aus der Adresse: "" bei einer Subdomain, "/lounge" bei einem Unterordner
base=$(node -e 'console.log(new URL(process.argv[1]).pathname.replace(/\/+$/, ""))' "$VITE_PUBLIC_SITE_URL")
dir="${DEPLOY_TARGET_DIR%/}"

# Schutz: nie ins Hauptverzeichnis des Webspace oder in den WordPress-Ordner
case "$dir" in
  "" | "." | "~" | "/") echo "DEPLOY_TARGET_DIR ($DEPLOY_TARGET_DIR) ist kein eigener Ordner" >&2; exit 1 ;;
esac
if [ -n "$base" ]; then
  case "$dir" in
    */"${base#/}" | "${base#/}") ;;
    *) echo "DEPLOY_TARGET_DIR ($dir) muss auf ${base} enden" >&2; exit 1 ;;
  esac
fi

# Passt der Build zur Adresse?
test -f dist/index.html && test -f dist/.htaccess || { echo "Kein Build in dist/ – erst npm run build" >&2; exit 1; }
grep -q "RewriteBase ${base}/$" dist/.htaccess || { echo "dist/ wurde für eine andere Adresse gebaut" >&2; exit 1; }
grep -q "src=\"${base}/assets/" dist/index.html || { echo "dist/index.html passt nicht zu ${VITE_PUBLIC_SITE_URL}" >&2; exit 1; }

if [ -n "${DEPLOY_SSH_KNOWN_HOSTS:-}" ]; then
  kh=$(mktemp)
  printf '%s\n' "$DEPLOY_SSH_KNOWN_HOSTS" > "$kh"
  ssh_opts="-o StrictHostKeyChecking=yes -o UserKnownHostsFile=$kh"
else
  echo "Hinweis: DEPLOY_SSH_KNOWN_HOSTS fehlt – Server-Schlüssel wird beim ersten Mal ungeprüft übernommen." >&2
  mkdir -p ~/.ssh
  ssh_opts="-o StrictHostKeyChecking=accept-new"
fi

export LFTP_PASSWORD="$DEPLOY_SFTP_PASSWORD"
sftp() { # führt lftp-Befehle im Zielordner aus
  lftp --norc -e "
    set cmd:fail-exit yes;
    set net:max-retries 3;
    set net:timeout 30;
    set sftp:auto-confirm no;
    set sftp:connect-program 'ssh -a -x $ssh_opts';
    open --env-password -p ${DEPLOY_SFTP_PORT:-22} -u '$DEPLOY_SFTP_USER' sftp://$DEPLOY_SFTP_HOST;
    mkdir -p -f '$dir';
    cd '$dir';
    $1
    bye
  "
}

# Liegt im Zielordner eine WordPress-Installation (falscher Ordner)? Dann abbrechen.
# Eine Platzhalter-index.php einer frischen mStudio-PHP-App ist kein Problem.
listing=$(sftp 'cls -1 -a;')
if grep -qxE '(\./)?(wp-config\.php|wp-content/?|wp-admin/?|wp-includes/?)' <<<"$listing"; then
  echo "Im Zielordner $dir liegt eine andere Website (WordPress) – Upload abgebrochen." >&2
  exit 1
fi

sftp "
  mirror -R --no-perms --exclude-glob index.html --exclude-glob .htaccess dist/ ./;
  put -O ./ dist/.htaccess;
  put -O ./ dist/index.html;
"
echo "Hochgeladen nach $dir"
