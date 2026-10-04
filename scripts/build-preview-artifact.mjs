// Macht aus dem Vorschau-Build (npm run build:preview) eine Artifact-Seite:
// ohne <html>/<head>/<body> (die setzt das Artifact selbst), mit Titel und einem
// ungeschichteten Grund-Style, damit die Standard-Styles des Artifacts unsere Farben nicht überschreiben.
// Aufruf: npm run build:preview && node scripts/build-preview-artifact.mjs [Zieldatei]
import { readFile, writeFile } from 'node:fs/promises';

const target = process.argv[2] ?? 'dist-vorschau/artifact.html';
const html = await readFile('dist-vorschau/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)?.[1] ?? '';
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
const assets = head.match(/<style[^>]*>[\s\S]*?<\/style>|<script[^>]*>[\s\S]*?<\/script>/g) ?? [];

const out = [
  '<title>Weihnachtsmarkt-Lounge Vorschau</title>',
  '<style>html,body{background:#fbf7ef;color:#23201b;margin:0}</style>',
  ...assets,
  body.trim(),
  '',
].join('\n');

await writeFile(target, out);
console.log(`${target}: ${(out.length / 1024).toFixed(0)} KB`);
