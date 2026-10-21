#!/usr/bin/env bash
# Lädt den fertigen Build (dist/) per SFTP in den Unterordner bei Strato, z. B. /lounge neben
# WordPress. Löscht nichts. Reihenfolge: erst alle Dateien, zuletzt .htaccess und index.html –
# so sieht niemand eine halb hochgeladene Seite.
#
# Benötigt: lftp, ssh und diese Umgebungsvariablen (nie ins Repo schreiben):
#   STRATO_SFTP_HOST, STRATO_SFTP_USER, STRATO_SFTP_PASSWORD, STRATO_TARGET_DIR,
#   VITE_PUBLIC_SITE_URL (dieselbe Adresse wie beim Build)
#   optional STRATO_SFTP_PORT (Standard 22), STRATO_SSH_KNOWN_HOSTS (Server-Schlüssel)
set -euo pipefail

for v in STRATO_SFTP_HOST STRATO_SFTP_USER STRATO_SFTP_PASSWORD STRATO_TARGET_DIR VITE_PUBLIC_SITE_URL; do
  if [ -z "${!v:-}" ]; then echo "Fehlt: $v (siehe docs/STRATO.md)" >&2; exit 1; fi
done

# Nie ins WordPress-Hauptverzeichnis: Zielordner muss auf den Unterordner der Adresse enden.
base=$(node -e 'console.log(new URL(process.argv[1]).pathname.replace(/\/+$/, ""))' "$VITE_PUBLIC_SITE_URL")
dir="${STRATO_TARGET_DIR%/}"
if [ -z "$base" ]; then
  echo "VITE_PUBLIC_SITE_URL braucht einen Unterordner, z. B. https://weihnachtsmarkt-detmold.de/lounge" >&2
  exit 1
fi
case "$dir" in
  */"${base#/}" | "${base#/}") ;;
  *) echo "STRATO_TARGET_DIR ($dir) muss auf ${base} enden" >&2; exit 1 ;;
esac

# Passt der Build zur Adresse?
test -f dist/index.html && test -f dist/.htaccess || { echo "Kein Build in dist/ – erst npm run build" >&2; exit 1; }
grep -q "RewriteBase ${base}/" dist/.htaccess || { echo "dist/ wurde für eine andere Adresse gebaut" >&2; exit 1; }
grep -q "src=\"${base}/assets/" dist/index.html || { echo "dist/index.html passt nicht zu ${base}" >&2; exit 1; }

mkdir -p ~/.ssh
if [ -n "${STRATO_SSH_KNOWN_HOSTS:-}" ]; then
  kh=$(mktemp)
  printf '%s\n' "$STRATO_SSH_KNOWN_HOSTS" > "$kh"
  ssh_opts="-o StrictHostKeyChecking=yes -o UserKnownHostsFile=$kh"
else
  echo "Hinweis: STRATO_SSH_KNOWN_HOSTS fehlt – Server-Schlüssel wird beim ersten Mal ungeprüft übernommen." >&2
  ssh_opts="-o StrictHostKeyChecking=accept-new"
fi

export LFTP_PASSWORD="$STRATO_SFTP_PASSWORD"
lftp --norc -e "
  set cmd:fail-exit yes;
  set net:max-retries 3;
  set net:timeout 30;
  set sftp:auto-confirm no;
  set sftp:connect-program 'ssh -a -x $ssh_opts';
  open --env-password -p ${STRATO_SFTP_PORT:-22} -u '$STRATO_SFTP_USER' sftp://$STRATO_SFTP_HOST;
  mkdir -p -f '$dir';
  cd '$dir';
  mirror -R --no-perms --exclude-glob index.html --exclude-glob .htaccess dist/ ./;
  put -O ./ dist/.htaccess;
  put -O ./ dist/index.html;
  bye
"
echo "Hochgeladen nach $dir"
