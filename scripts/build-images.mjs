// Erzeugt optimierte Bilder aus /assets nach src/assets bzw. public.
// Aufruf: node scripts/build-images.mjs (nur nötig, wenn sich /assets ändert; Ergebnisse werden committet).
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const LOGO = 'assets/haendler-logo-schmal.png';

// Händler-Logo: transparenten Rand entfernen, Farben unverändert lassen.
const trimmed = await sharp(LOGO).trim({ threshold: 1 }).png().toBuffer();
for (const width of [480, 960]) {
  await sharp(trimmed)
    .resize({ width })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`src/assets/haendler-logo-${width}.webp`);
}

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
