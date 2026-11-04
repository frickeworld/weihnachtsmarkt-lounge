#!/usr/bin/env bash
# Startet Supabase in der CI robust. Auf GitHub-Runnern war Port 54322 (Datenbank) schon
# zweimal belegt („address already in use“), bevor ein Test lief. Dann weichen wir auf einen
# freien Port aus; schlägt der Start trotzdem fehl, wird einmal sauber neu gestartet.
# Aufruf: scripts/ci-supabase-start.sh supabase db start
#         scripts/ci-supabase-start.sh supabase start -x studio,…
set -uo pipefail

port_busy() { ss -ltn 2>/dev/null | grep -q ":$1 "; }

if port_busy 54322; then
  echo "::warning::Port 54322 ist auf dem Runner belegt – weiche auf 55322 aus."
  ss -ltnp 2>/dev/null | grep ':54322 ' || true
  sed -i 's/^port = 54322$/port = 55322/' supabase/config.toml
fi

if "$@"; then exit 0; fi

echo "::warning::Supabase-Start fehlgeschlagen – räume auf und versuche es einmal erneut."
supabase stop --no-backup >/dev/null 2>&1 || true
if port_busy 54322 || port_busy 55322; then
  sed -i 's/^port = 5[45]322$/port = 56322/' supabase/config.toml
fi
sleep 5
"$@"
