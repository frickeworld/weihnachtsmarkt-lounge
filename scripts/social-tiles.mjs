// Instagram-Kacheln für @diehaendlerdetmold: Posts (1080×1350) und Storys (1080×1920) als PNG.
// Aufruf: npm run social  →  Dateien in social/ (nicht im Repo, siehe .gitignore).
// Preise kommen aus der Startwert-Preisliste in src/lib/settings.ts (gleich der Datenbank).
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const OUT = 'social';
const b64 = async (path, type) =>
  `data:${type};base64,${(await readFile(path)).toString('base64')}`;

// Preisliste aus src/lib/settings.ts lesen: tier(d, '16:45', '18:45', 149, 75, 'Früher Abend')
const settingsSrc = await readFile('src/lib/settings.ts', 'utf8');
const list = settingsSrc.slice(settingsSrc.indexOf('FALLBACK_PRICE_LIST'));
const tiers = [];
const groupRe =
  /\.\.\.\[([\d, ]+)\]\.flatMap\(\(d\) => \[([\s\S]*?)\]\)|tier\((\d), '([\d:]+)', '([\d:]+)', (\d+), (\d+), '([^']+)'\)/g;
for (const m of list.slice(0, list.indexOf('];') + 2).matchAll(groupRe)) {
  if (m[1]) {
    const days = m[1].split(',').map(Number);
    for (const t of m[2].matchAll(/tier\(d, '([\d:]+)', '([\d:]+)', (\d+), (\d+), '([^']+)'\)/g))
      for (const d of days)
        tiers.push({ d, start: t[1], end: t[2], price: +t[3], taler: +t[4], label: t[5] });
  } else if (m[3]) {
    tiers.push({ d: +m[3], start: m[4], end: m[5], price: +m[6], taler: +m[7], label: m[8] });
  }
}
if (!tiers.length) throw new Error('Preisliste nicht gefunden');
const minPrice = Math.min(...tiers.map((t) => t.price));
const maxTaler = Math.max(...tiers.map((t) => t.taler));
const groups = [
  { days: 'Montag bis Donnerstag', d: [1, 2, 3, 4] },
  { days: 'Freitag und Samstag', d: [5, 6] },
  { days: 'Sonntag', d: [7] },
].map((g) => ({
  ...g,
  rows: tiers.filter((t) => t.d === g.d[0]).sort((a, b) => a.start.localeCompare(b.start)),
}));

const [jost, manrope4, manrope7, hero, glitter, logo, taler, marketLogo] = await Promise.all([
  b64('node_modules/@fontsource/jost/files/jost-latin-500-normal.woff2', 'font/woff2'),
  b64('node_modules/@fontsource/manrope/files/manrope-latin-400-normal.woff2', 'font/woff2'),
  b64('node_modules/@fontsource/manrope/files/manrope-latin-700-normal.woff2', 'font/woff2'),
  b64('src/assets/hero-1200.webp', 'image/webp'),
  b64('src/assets/gold-glitzer.webp', 'image/webp'),
  b64('src/assets/haendler-logo-weiss-960.webp', 'image/webp'),
  b64('src/assets/taler-192.webp', 'image/webp'),
  b64('src/assets/weihnachtsmarkt-logo.svg', 'image/svg+xml'),
]);

const css = `
@font-face { font-family: Jost; src: url(${jost}); font-weight: 500; }
@font-face { font-family: Manrope; src: url(${manrope4}); font-weight: 400; }
@font-face { font-family: Manrope; src: url(${manrope7}); font-weight: 700; }
* { box-sizing: border-box; margin: 0; }
body { width: var(--w); height: var(--h); font-family: Manrope, sans-serif; color: #23201B; background: #FBF7EF; overflow: hidden; }
.glitter { background: #C6A45C url(${glitter}) center/cover; }
.dark { background: #24221E; color: #F8F3E8; }
.display { font-family: Jost, sans-serif; font-weight: 500; letter-spacing: -0.01em; }
.eyebrow { font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; font-size: 28px; }
.band { height: 188px; display: flex; align-items: center; justify-content: center; }
.band img { height: 120px; }
.foot { position: absolute; left: 0; right: 0; bottom: 0; height: 136px; padding: 0 64px; display: flex; align-items: center; justify-content: space-between; }
.foot img { height: 64px; }
.cta { display: inline-block; padding: 26px 54px; border-radius: 999px; font-weight: 700; font-size: 34px; }
`;

const foot = `<div class="foot dark"><img src="${logo}" alt=""><span style="font-size:26px;opacity:.85">Link in der Bio · Powered by STUDIO/F</span></div>`;
const euro = (n) => `${n} €`;
/** Für den Post: Zeitfenster mit gleichem Preis in einer Zeile zusammenfassen (Platz). */
const compact = (rows) =>
  rows.every((r) => r.price === rows[0].price && r.taler === rows[0].taler) && rows.length > 1
    ? [
        {
          ...rows[0],
          label: rows.length === 2 ? 'Beide Abende' : 'Alle Zeitfenster',
          start: rows.map((r) => r.start).join(' · '),
          end: null,
        },
      ]
    : rows;

/** Inhalt je Motiv – `tall` = Story-Format. */
const motifs = {
  'lounge-ab-preis': (tall) => `
    <div class="band glitter"><img src="${marketLogo}" alt=""></div>
    <div style="position:absolute;left:0;right:0;top:188px;bottom:136px;background:url(${hero}) 60% 30%/cover">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,19,17,.1),rgba(20,19,17,.9))"></div>
      <div style="position:absolute;left:64px;right:64px;bottom:${tall ? 120 : 60}px;color:#F8F3E8">
        <p class="eyebrow" style="color:#E8D6A8">Schlosspark Detmold · Dezember</p>
        <h1 class="display" style="font-size:${tall ? 108 : 92}px;line-height:1.02;margin-top:22px">Deine Lounge mitten im Weihnachtsmarkt</h1>
        <div class="glitter" style="display:inline-flex;align-items:center;gap:26px;margin-top:40px;padding:22px 34px;border-radius:28px;color:#23201B">
          <span style="font-weight:700;font-size:26px;text-transform:uppercase">bis zu</span>
          <span class="display" style="font-size:96px;line-height:1">${euro(maxTaler)}</span>
          <span style="font-weight:700;font-size:26px;text-transform:uppercase;line-height:1.15">Freiverzehr<br>inklusive</span>
        </div>
        <p style="font-size:40px;margin-top:36px">Bis zu 10 Personen · 2 Stunden · Tischservice · <b>ab ${euro(minPrice)}</b></p>
      </div>
    </div>${foot}`,

  preise: (tall) => `
    <div class="band glitter"><img src="${marketLogo}" alt=""></div>
    <div style="padding:${tall ? 110 : 40}px 64px 0">
      <p class="eyebrow" style="color:#7A5A1E">Preise und Zeiten</p>
      <h1 class="display" style="font-size:${tall ? 88 : 76}px;margin-top:12px">Deine Lounge ab ${euro(minPrice)}</h1>
      <p style="font-size:${tall ? 30 : 26}px;color:#5F574B;margin-top:10px">Endpreise inkl. 3,50 € Vorverkaufsgebühr und Freiverzehr · bis zu 10 Personen · 2 Stunden</p>
      ${groups
        .map(
          (
            g,
          ) => `<p class="eyebrow" style="color:#7A5A1E;font-size:${tall ? 24 : 21}px;margin-top:${tall ? 60 : 20}px">${g.days}</p>
        ${(tall ? g.rows : compact(g.rows))
          .map(
            (
              r,
            ) => `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #E4D8C2;padding:${tall ? 22 : 11}px 4px">
              <span style="font-size:${tall ? 34 : 29}px"><b>${r.label}</b> <span style="color:#5F574B">${r.end ? `${r.start}–${r.end}` : r.start} Uhr</span></span>
              <span><span class="display" style="font-size:${tall ? 50 : 40}px">${euro(r.price)}</span> <span style="color:#7A5A1E;font-size:${tall ? 26 : 22}px">inkl. ${r.taler} €</span></span>
            </div>`,
          )
          .join('')}`,
        )
        .join('')}
    </div>${foot}`,

  erlebnis: (tall) => `
    <div class="band glitter"><img src="${marketLogo}" alt=""></div>
    <div style="padding:${tall ? 140 : 50}px 64px 0">
      <p class="eyebrow" style="color:#7A5A1E">Das ist drin</p>
      <h1 class="display" style="font-size:${tall ? 92 : 78}px;line-height:1.05;margin-top:16px">Ein Abend, um den sich jemand kümmert</h1>
      ${[
        [
          'Exklusiv für euch',
          'Überdachte Lounge, 2 Stunden nur für deine Runde – bis zu 10 Personen.',
        ],
        [
          `Bis zu ${euro(maxTaler)} Freiverzehr`,
          'In Residenztalern, einlösbar an den Ständen des Weihnachtsmarkts.',
        ],
        ['Tischservice', 'Die Tanzschule Fricke kommt an euren Tisch.'],
        ['Ticket aufs Handy', 'QR-Code per E-Mail, auch für Apple und Google Wallet.'],
      ]
        .map(
          ([
            t,
            d,
          ]) => `<div style="display:flex;gap:28px;margin-top:${tall ? 56 : 30}px;align-items:flex-start">
            <span class="glitter" style="flex:none;width:18px;height:${tall ? 110 : 88}px;border-radius:9px"></span>
            <div><b class="display" style="font-size:${tall ? 48 : 42}px">${t}</b><p style="font-size:${tall ? 32 : 29}px;color:#5F574B;margin-top:4px">${d}</p></div>
          </div>`,
        )
        .join('')}
    </div>${foot}`,

  verschenken: (tall) => `
    <div class="dark" style="position:absolute;inset:0"></div>
    <div style="position:relative;text-align:center;padding:${tall ? 300 : 150}px 70px 0;color:#F8F3E8">
      <p class="eyebrow" style="color:#E8D6A8">Die Geschenkidee</p>
      <h1 class="display" style="font-size:104px;line-height:1.02;margin-top:24px">Verschenk einen Abend in der Lounge</h1>
      <img src="${taler}" alt="" style="width:${tall ? 300 : 240}px;margin-top:${tall ? 80 : 50}px">
      <p style="font-size:38px;margin-top:${tall ? 70 : 40}px;opacity:.9">Buchen, Geschenk-Karte ausdrucken, unter den Baum legen.<br>Inklusive bis zu ${euro(maxTaler)} Freiverzehr.</p>
      <p class="cta glitter" style="margin-top:${tall ? 80 : 50}px;color:#23201B">Lounge buchen</p>
    </div>${foot}`,
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, render] of Object.entries(motifs)) {
  for (const [format, w, h] of [
    ['post', 1080, 1350],
    ['story', 1080, 1920],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>:root{--w:${w}px;--h:${h}px}${css}</style></head><body><div style="position:relative;width:${w}px;height:${h}px">${render(format === 'story')}</div></body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${OUT}/${name}-${format}.png` });
  }
}
await browser.close();
console.log(`Instagram-Kacheln erzeugt in ${OUT}/`);
