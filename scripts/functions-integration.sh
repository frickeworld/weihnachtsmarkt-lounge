#!/usr/bin/env bash
# Startet stripe-mock und alle Edge Functions lokal (Deno) gegen die lokale Supabase-Instanz
# und führt den Integrationstest aus. Voraussetzung: `npx supabase start` läuft, Docker, Deno.
set -euo pipefail
cd "$(dirname "$0")/.."

STATUS=$(npx supabase status -o env)
export SUPABASE_URL=$(echo "$STATUS" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
export SUPABASE_SERVICE_ROLE_KEY=$(echo "$STATUS" | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')
export STRIPE_SECRET_KEY=sk_test_123
export STRIPE_API_BASE=http://127.0.0.1:12111
export STRIPE_WEBHOOK_SECRET=whsec_integration_test
export PUBLIC_SITE_URL=http://127.0.0.1:4173

docker rm -f stripe-mock >/dev/null 2>&1 || true
docker run -d --name stripe-mock -p 12111:12111 stripe/stripe-mock:latest >/dev/null

pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  docker rm -f stripe-mock >/dev/null 2>&1 || true
}
trap cleanup EXIT

port=8101
for f in create-checkout stripe-webhook release-hold send-ticket; do
  DENO_SERVE_ADDRESS="tcp:127.0.0.1:$port" deno run -A --config "supabase/functions/$f/deno.json" \
    "supabase/functions/$f/index.ts" >"/tmp/fn-$f.log" 2>&1 &
  pids+=($!)
  port=$((port + 1))
done

for p in 8101 8102 8103 8104 12111; do
  for _ in $(seq 1 60); do
    (echo >"/dev/tcp/127.0.0.1/$p") 2>/dev/null && break
    sleep 1
  done
done

deno test -A --config supabase/functions/_tests/deno.json supabase/functions/_tests/
