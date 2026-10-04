#!/usr/bin/env bash
# Startet stripe-mock und alle Edge Functions lokal (Deno) gegen die lokale Supabase-Instanz
# und führt den Integrationstest aus. Voraussetzung: `npx supabase start` läuft, Docker, Deno.
set -euo pipefail
cd "$(dirname "$0")/.."

STATUS=$(npx supabase status -o env)
export SUPABASE_URL=$(echo "$STATUS" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
export SUPABASE_SERVICE_ROLE_KEY=$(echo "$STATUS" | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')
export MAILPIT_URL=$(echo "$STATUS" | grep '^MAILPIT_URL=' | cut -d= -f2- | tr -d '"')
export SUPABASE_ANON_KEY=$(echo "$STATUS" | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"')
export STRIPE_SECRET_KEY=sk_test_123
export STRIPE_API_BASE=http://127.0.0.1:12111
export STRIPE_WEBHOOK_SECRET=whsec_integration_test
export PUBLIC_SITE_URL=http://127.0.0.1:4173
export CRON_SECRET=cron_integration_test
export SCANNER_TOKEN_SECRET=scanner_integration_test
# Brevo-Simulator läuft im Test selbst (Port 8199)
export BREVO_API_BASE=http://127.0.0.1:8199
export BREVO_API_KEY=brevo_test_key
export BREVO_SENDER_EMAIL=tickets@studio-f.club
export BREVO_LIST_BOOKINGS=7
export BREVO_LIST_NEWSLETTER=8
export BREVO_DOI_TEMPLATE_ID=9

# Wallet: Test-Zertifikate (selbst signiert) statt der echten Apple-Zertifikate, Google-API simuliert der Test
WALLET_DIR=$(mktemp -d)
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=Test WWDR" \
  -keyout "$WALLET_DIR/ca.key" -out "$WALLET_DIR/ca.pem" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj "/CN=Pass Type ID: pass.test.lounge" \
  -keyout "$WALLET_DIR/pass.key" -out "$WALLET_DIR/pass.csr" 2>/dev/null
openssl x509 -req -in "$WALLET_DIR/pass.csr" -CA "$WALLET_DIR/ca.pem" -CAkey "$WALLET_DIR/ca.key" \
  -CAcreateserial -days 2 -out "$WALLET_DIR/pass.pem" 2>/dev/null
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$WALLET_DIR/google.key" 2>/dev/null
export APPLE_PASS_TYPE_ID=pass.test.lounge
export APPLE_TEAM_ID=TEAMID1234
export APPLE_PASS_CERT="$(cat "$WALLET_DIR/pass.pem")"
export APPLE_PASS_KEY="$(cat "$WALLET_DIR/pass.key")"
export APPLE_WWDR_CERT="$(cat "$WALLET_DIR/ca.pem")"
export TEST_WALLET_CA_FILE="$WALLET_DIR/ca.pem"
export GOOGLE_WALLET_ISSUER_ID=3388000000000000000
export GOOGLE_WALLET_SERVICE_ACCOUNT="$(python3 -c 'import json,sys; print(json.dumps({"client_email":"wallet@test.iam.gserviceaccount.com","private_key":open(sys.argv[1]).read()}))' "$WALLET_DIR/google.key")"
export GOOGLE_WALLET_API_BASE=http://127.0.0.1:8198/walletobjects/v1
export GOOGLE_OAUTH_TOKEN_URL=http://127.0.0.1:8198/token

docker rm -f stripe-mock >/dev/null 2>&1 || true
docker run -d --name stripe-mock -p 12111:12111 stripe/stripe-mock:latest >/dev/null

pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  docker rm -f stripe-mock >/dev/null 2>&1 || true
  rm -rf "$WALLET_DIR"
}
trap cleanup EXIT

port=8101
for f in create-checkout stripe-webhook release-hold send-ticket send-reminders admin ticket-files scanner; do
  DENO_SERVE_ADDRESS="tcp:127.0.0.1:$port" deno run -A --config "supabase/functions/$f/deno.json" \
    "supabase/functions/$f/index.ts" >"/tmp/fn-$f.log" 2>&1 &
  pids+=($!)
  port=$((port + 1))
done

for p in 8101 8102 8103 8104 8105 8106 8107 8108 12111; do
  for _ in $(seq 1 60); do
    (echo >"/dev/tcp/127.0.0.1/$p") 2>/dev/null && break
    sleep 1
  done
done

deno test -A --config supabase/functions/_tests/deno.json supabase/functions/_tests/
