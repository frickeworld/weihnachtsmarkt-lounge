# Weihnachtsmarkt-Lounge der Händler

Buchungssystem für die Lounge auf dem Weihnachtsmarkt im Schlosspark Detmold.

- **Projektregeln:** [`CLAUDE.md`](CLAUDE.md)
- **Spezifikation, Datenmodell, Phasen:** [`SPEC.md`](SPEC.md)
- **Einrichtung (Cloudflare, Secrets, Supabase, Stripe, Brevo):** [`docs/SETUP.md`](docs/SETUP.md)

## Befehle

| Befehl                                                        | Zweck                                        |
| ------------------------------------------------------------- | -------------------------------------------- |
| `npm run dev`                                                 | Entwicklungsserver auf http://127.0.0.1:5173 |
| `npm run build`                                               | Statischer Build nach `dist/`                |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Code-Prüfungen                               |
| `npm test`                                                    | Unit-Tests (Vitest)                          |
| `npm run test:e2e`                                            | Klicktests (Playwright)                      |

## Struktur

```
assets/              Originaldateien (Logos von die-haendler-detmold.de und studio-f.club)
src/                 React-App (Vite, TypeScript, Tailwind)
supabase/            Supabase-CLI: config.toml, migrations, functions, tests
tests/e2e/           Playwright
.github/workflows/   CI und Supabase-Deployment (main = live)
docs/                Anleitungen
```
