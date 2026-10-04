// Erzeugt optimierte Bilder aus /assets nach src/assets bzw. public.
// Aufruf: node scripts/build-images.mjs (nur nötig, wenn sich /assets ändert; Ergebnisse werden committet).
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';

const LOGO = 'assets/haendler-logo-schmal.png';

// Händler-Logo: transparenten Rand entfernen, Farben unverändert lassen.
const trimmed = await sharp(LOGO).trim({ threshold: 1 }).png().toBuffer();
for (const width of [480, 960]) {
  await sharp(trimmed)
    .resize({ width })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`src/assets/haendler-logo-${width}.webp`);
}

// E-Mail und PDF: PNG (WebP zeigen nicht alle Mail-Programme an), 2× für Retina.
await mkdir('public/email', { recursive: true });
await sharp(trimmed)
  .resize({ width: 440 })
  .png({ compressionLevel: 9, palette: true })
  .toFile('public/email/haendler-logo.png');

// Open-Graph-Bild (1200×630): Nachtschwarz, Goldlicht, Logo auf Creme-Plakette, Titel.
// Wird ersetzt, sobald ein Hero-Foto vorliegt.
const W = 1200;
const H = 630;
const logo = await sharp(trimmed).resize({ width: 640 }).png().toBuffer();
const { height: logoH = 0 } = await sharp(logo).metadata();
const plaqueW = 760;
const plaqueH = logoH + 70;
const plaqueX = (W - plaqueW) / 2;
const plaqueY = 120;

const bulbs = Array.from({ length: 22 }, (_, i) => {
  const x = 30 + i * ((W - 60) / 21);
  const t = (x - W / 2) / (W / 2);
  const y = 26 + 40 * (1 - t * t);
  const color = i % 3 === 0 ? '#E9D8A6' : '#FFE9B8';
  return `<circle cx="${x}" cy="${y + 9}" r="6" fill="${color}" filter="url(#glow)"/>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="g1" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#3a2a14"/><stop offset="0.55" stop-color="#15110d"/><stop offset="1" stop-color="#0F0D0B"/>
    </radialGradient>
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#g1)"/>
  <path d="M0 26 Q ${W / 2} 106 ${W} 26" stroke="#3b3026" stroke-width="2" fill="none"/>
  ${bulbs}
  <rect x="${plaqueX}" y="${plaqueY}" width="${plaqueW}" height="${plaqueH}" rx="3" fill="#F6EFE3" stroke="#C9A24D" stroke-width="3"/>
  <line x1="${W / 2 - 60}" y1="${plaqueY + plaqueH + 50}" x2="${W / 2 + 60}" y2="${plaqueY + plaqueH + 50}" stroke="#C9A24D" stroke-width="2"/>
  <text x="50%" y="${plaqueY + plaqueH + 125}" text-anchor="middle" font-family="Georgia, serif" font-size="50" fill="#F6EFE3">Deine Lounge mitten im Weihnachtsmarkt</text>
  <text x="50%" y="${plaqueY + plaqueH + 180}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="5" fill="#E9D8A6">WEIHNACHTSMARKT IM SCHLOSSPARK DETMOLD</text>
</svg>`;

await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: Math.round((W - 640) / 2), top: plaqueY + 35 }])
  .png({ compressionLevel: 9 })
  .toFile('public/og-image.png');

console.log('Bilder erzeugt:', (await readFile('public/og-image.png')).length, 'Bytes OG');

// ---------------------------------------------------------------------------------------
// Design-Runde 1: helles Design mit Gold-Glitzer (Material von weihnachtsmarkt-detmold.de)
// ---------------------------------------------------------------------------------------
import { readdir } from 'node:fs/promises';

await mkdir('src/assets/sponsoren', { recursive: true });

// Händler-Logo komplett weiß. Die vier Quadrate des Signets bekommen abgestufte Deckkraft,
// damit das Raster als Weiß-Ton-Fläche erkennbar bleibt.
{
  const { data, info } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const base = [
    { rgb: [205, 19, 28], a: 1 }, // Rot
    { rgb: [255, 203, 0], a: 0.82 }, // Gelb
    { rgb: [180, 159, 131], a: 0.62 }, // Beige
    { rgb: [255, 255, 255], a: 0.38 }, // Weiß
    { rgb: [74, 74, 73], a: 1 }, // Schriftzug grau
  ];
  for (let i = 0; i < data.length; i += 4) {
    const px = [data[i], data[i + 1], data[i + 2]];
    let best = base[0];
    let bestD = Infinity;
    for (const b of base) {
      const d = (px[0] - b.rgb[0]) ** 2 + (px[1] - b.rgb[1]) ** 2 + (px[2] - b.rgb[2]) ** 2;
      if (d < bestD) [best, bestD] = [b, d];
    }
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(data[i + 3] * best.a);
  }
  const white = sharp(data, { raw: info });
  for (const width of [480, 960]) {
    await white
      .clone()
      .resize({ width })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(`src/assets/haendler-logo-weiss-${width}.webp`);
  }
  await white
    .clone()
    .resize({ width: 440 })
    .png({ compressionLevel: 9 })
    .toFile('public/email/haendler-logo-weiss.png');
}

// Hero-Foto (Platzhalter, Bildquelle: Stadt Detmold) und Gold-Glitzer-Textur
for (const width of [800, 1200]) {
  await sharp('assets/weihnachtsmarkt/foto-gaeste-gluehwein-stadt-detmold.webp')
    .resize({ width })
    .webp({ quality: 74 })
    .toFile(`src/assets/hero-${width}.webp`);
}
await sharp('assets/weihnachtsmarkt/gold-glitzer.webp')
  .resize({ width: 640 })
  .webp({ quality: 45 })
  .toFile('src/assets/gold-glitzer.webp');

// Sponsorenlogos einheitlich weiß, 80 px hoch
for (const file of await readdir('assets/sponsoren')) {
  if (!file.endsWith('.png')) continue;
  const { data, info } = await sharp(`assets/sponsoren/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255;
  const name = file.replace(/(-logo)?(-weiss)?(-72dpi)?(-1)?\.png$/, '').replace(/_logo$/, '');
  await sharp(data, { raw: info })
    .trim({ threshold: 1 })
    .resize({ height: 80, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`src/assets/sponsoren/${name}.webp`);
}

// ---------------------------------------------------------------------------------------
// E-Mail- und PDF-Kopf: Gold-Glitzer mit Markt-Schriftzug (helles Design)
// ---------------------------------------------------------------------------------------
{
  const W = 1200;
  const H = 240;
  const logoW = 620;
  const marktLogo = await sharp('assets/weihnachtsmarkt/weihnachtsmarkt-logo.svg', { density: 300 })
    .resize({ width: logoW })
    .png()
    .toBuffer();
  const { height: lh = 0 } = await sharp(marktLogo).metadata();
  await sharp('assets/weihnachtsmarkt/gold-glitzer.webp')
    .resize({ width: W, height: H, fit: 'cover' })
    .composite([
      { input: marktLogo, left: Math.round((W - logoW) / 2), top: Math.round((H - lh) / 2) },
    ])
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile('public/email/kopf.jpg');
}
