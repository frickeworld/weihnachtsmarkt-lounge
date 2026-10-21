#!/usr/bin/env bash
# Prüft den Live-Aufbau bei Strato: WordPress im Hauptverzeichnis, die Lounge im Unterordner
# /lounge mit eigener .htaccess. Startet einen echten Apache (Docker) und fragt Adressen ab.
# Aufruf: bash scripts/apache-subfolder-test.sh
set -euo pipefail

PORT=8088
DIR=$(mktemp -d)
NAME=lounge-apache-test
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

mkdir -p "$DIR/htdocs"
VITE_SUPABASE_URL=http://supabase.test VITE_SUPABASE_ANON_KEY=test \
  VITE_PUBLIC_SITE_URL="http://127.0.0.1:$PORT/lounge" \
  npx vite build --outDir "$DIR/htdocs/lounge" --emptyOutDir >/dev/null

# Ersatz für WordPress: gleiche Rewrite-Regeln wie eine Standard-Installation
echo 'WORDPRESS' > "$DIR/htdocs/index.html"
cat > "$DIR/htdocs/.htaccess" <<'HT'
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
</IfModule>
# END WordPress
HT

docker run --rm httpd:2.4 cat /usr/local/apache2/conf/httpd.conf > "$DIR/httpd.conf"
sed -i -e 's/^#LoadModule rewrite_module/LoadModule rewrite_module/' \
  -e 's/^#LoadModule headers_module/LoadModule headers_module/' \
  -e 's/^#LoadModule deflate_module/LoadModule deflate_module/' \
  -e 's/AllowOverride None/AllowOverride All/g' -e "s/^Listen 80/Listen $PORT/" "$DIR/httpd.conf"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --network host \
  -v "$DIR/htdocs:/usr/local/apache2/htdocs:ro" \
  -v "$DIR/httpd.conf:/usr/local/apache2/conf/httpd.conf:ro" httpd:2.4 >/dev/null
for _ in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done

fail=0
check() { # Pfad, erwarteter Status, erwarteter Textanfang (optional)
  local body code
  body=$(mktemp)
  code=$(curl -s -o "$body" -w '%{http_code}' -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$PORT$1")
  if [ "$code" != "$2" ] || { [ -n "${3:-}" ] && ! head -c 200 "$body" | grep -q "$3"; }; then
    echo "FEHLER $1: Status $code (erwartet $2${3:+, Inhalt „$3“})"
    fail=1
  else
    echo "ok     $1 → $code"
  fi
  rm -f "$body"
}
check / 200 WORDPRESS
check /eine-wordpress-seite 200 WORDPRESS
check /lounge 301
check /lounge/ 200 '<!doctype html>'
check /lounge/ticket/AbCdEf0123456789AbCdEf0123456789 200 '<!doctype html>'
check /lounge/admin/kalender 200 '<!doctype html>'
check /lounge/favicon.png 200
check /lounge/email/haendler-logo-weiss.png 200
check /lounge/robots.txt 200 'User-agent'

# http → https
code=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://127.0.0.1:$PORT/lounge/agb")
[[ "$code" == "301 https://127.0.0.1:$PORT/lounge/agb" ]] && echo "ok     http → https" ||
  { echo "FEHLER http → https: $code"; fail=1; }
# Interne Bereiche: noindex; Sicherheits-Header; kein HSTS für die ganze Domain
h=$(curl -sI -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$PORT/lounge/admin")
grep -qi '^x-robots-tag: noindex' <<<"$h" && grep -qi '^content-security-policy:' <<<"$h" &&
  ! grep -qi '^strict-transport-security' <<<"$h" && echo "ok     Header /lounge/admin" ||
  { echo "FEHLER Header /lounge/admin"; fail=1; }
# Eingebundene Dateien liegen unter /lounge/
grep -q 'src="/lounge/assets/' "$DIR/htdocs/lounge/index.html" && echo "ok     Pfade in index.html" ||
  { echo "FEHLER Pfade in index.html"; fail=1; }

exit $fail
