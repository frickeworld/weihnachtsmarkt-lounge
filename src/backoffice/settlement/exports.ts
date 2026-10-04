import { csvEuro, toCsv } from '../admin/csv';
import type { Settlement } from './types';

export const SETTLEMENT_FOOTER =
  'Grundlage für eure Rechnung an die MF Coaching & Promotion GmbH. Dies ist keine Rechnung.';

const de = (iso: string) => iso.split('-').reverse().join('.');
export const periodLabel = (s: Pick<Settlement, 'from' | 'to'>) => `${de(s.from)} – ${de(s.to)}`;
const euro = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);

/** CSV (Semikolon, UTF-8 mit BOM): Einzelaufstellung plus Summenzeile. */
export function settlementCsv(s: Settlement): string {
  const admin = s.revenue_cents !== null;
  const header = [
    'Datum',
    'Beginn',
    'Ende',
    'Buchungscode',
    'Name',
    'Firma',
    'Personen',
    'Erschienen',
    'Händler-Anteil €',
    ...(admin ? ['Gesamt €', 'Studio F €'] : []),
  ];
  const rows = s.rows.map((r) => [
    de(r.date),
    r.start_time,
    r.end_time,
    r.booking_code,
    r.name,
    r.company_name,
    r.persons,
    r.checked_in ? 'ja' : 'nein',
    csvEuro(r.haendler_share_cents),
    ...(admin
      ? [
          csvEuro(r.amount_total_cents ?? 0),
          csvEuro((r.amount_total_cents ?? 0) - r.haendler_share_cents),
        ]
      : []),
  ]);
  const sum = [
    'Summe',
    '',
    '',
    `${s.count} Buchungen`,
    '',
    '',
    '',
    '',
    csvEuro(s.haendler_cents),
    ...(admin ? [csvEuro(s.revenue_cents ?? 0), csvEuro(s.studio_cents ?? 0)] : []),
  ];
  return toCsv(header, [...rows, sum]);
}

/** Entfernt Zeichen, die die PDF-Standardschrift (WinAnsi) nicht kann, z. B. Emojis. */
function safe(text: string): string {
  return text.replace(
    /[^\u0020-\u007E\u00A0-\u00FF\u20AC\u201E\u201C\u201D\u2013\u2014\u2026\u2022]/g,
    '',
  );
}

/**
 * PDF „Abrechnungsübersicht Weihnachtsmarkt-Lounge [Zeitraum]“, A4 quer nicht nötig: A4 hoch,
 * Summen oben, Einzelaufstellung mit Seitenumbruch, Fußzeile auf jeder Seite.
 */
export async function settlementPdf(
  s: Settlement,
  logoPng?: Uint8Array | null,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const admin = s.revenue_cents !== null;
  const hex = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };
  const INK = hex('#23201B');
  const SOFT = hex('#5F574B');
  const LINE = hex('#E4D8C2');
  const BROWN = hex('#24221E');
  const GOLD = hex('#C6A45C');
  const SAND = hex('#F3EBDC');

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Abrechnungsübersicht Weihnachtsmarkt-Lounge ${periodLabel(s)}`);
  pdf.setAuthor('Weihnachtsmarkt-Lounge der Händler');
  pdf.setLanguage('de-DE');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = logoPng ? await pdf.embedPng(logoPng).catch(() => null) : null;

  const W = 595.28;
  const H = 841.89;
  const M = 40;
  const cols = admin
    ? [
        { t: 'Datum', x: M, w: 58 },
        { t: 'Zeit', x: M + 58, w: 62 },
        { t: 'Code', x: M + 120, w: 78 },
        { t: 'Name / Firma', x: M + 198, w: 140 },
        { t: 'Pers.', x: M + 338, w: 30 },
        { t: 'Da', x: M + 368, w: 26 },
        { t: 'Gesamt', x: M + 394, w: 60, right: true },
        { t: 'Händler', x: M + 454, w: 61, right: true },
      ]
    : [
        { t: 'Datum', x: M, w: 62 },
        { t: 'Zeit', x: M + 62, w: 66 },
        { t: 'Code', x: M + 128, w: 84 },
        { t: 'Name / Firma', x: M + 212, w: 170 },
        { t: 'Pers.', x: M + 382, w: 34 },
        { t: 'Da', x: M + 416, w: 34 },
        { t: 'Händler', x: M + 450, w: 65, right: true },
      ];

  const fit = (text: string, f: typeof font, size: number, width: number) => {
    let t = safe(text);
    while (t && f.widthOfTextAtSize(t, size) > width - 4) t = t.slice(0, -1);
    return t;
  };

  const pages: ReturnType<typeof pdf.addPage>[] = [];
  const newPage = (first: boolean) => {
    const p = pdf.addPage([W, H]);
    pages.push(p);
    let y = H;
    if (first) {
      p.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: BROWN });
      p.drawRectangle({ x: 0, y: H - 74, width: W, height: 4, color: GOLD });
      if (logo) {
        const scale = 34 / logo.height;
        p.drawImage(logo, { x: M, y: H - 52, width: logo.width * scale, height: 34 });
      }
      y = H - 108;
      p.drawText('Abrechnungsübersicht Weihnachtsmarkt-Lounge', {
        x: M,
        y,
        size: 18,
        font: bold,
        color: INK,
      });
      y -= 20;
      p.drawText(
        `Zeitraum ${periodLabel(s)} · erstellt am ${new Date().toLocaleDateString('de-DE')}`,
        {
          x: M,
          y,
          size: 10,
          font,
          color: SOFT,
        },
      );
      y -= 22;
      const boxes: [string, string][] = [
        ['Buchungen', String(s.count)],
        ['davon nicht erschienen', String(s.no_shows)],
        ['Anteil Händler', euro(s.haendler_cents)],
        ...(admin
          ? ([
              ['Umsatz brutto', euro(s.revenue_cents ?? 0)],
              ['Anteil Studio F', euro(s.studio_cents ?? 0)],
            ] as [string, string][])
          : []),
      ];
      const bw = (W - 2 * M - (boxes.length - 1) * 8) / boxes.length;
      boxes.forEach(([label, value], i) => {
        const x = M + i * (bw + 8);
        p.drawRectangle({
          x,
          y: y - 50,
          width: bw,
          height: 50,
          color: SAND,
          borderColor: LINE,
          borderWidth: 1,
        });
        p.drawText(safe(label), { x: x + 8, y: y - 16, size: 8, font, color: SOFT });
        p.drawText(safe(value), { x: x + 8, y: y - 38, size: 14, font: bold, color: INK });
      });
      y -= 64;
      const note = safe(
        `Berechnet werden bezahlte Buchungen, auch wenn die Gäste nicht erschienen sind. Nicht enthalten: ${s.excluded_cancelled} stornierte und ${s.excluded_not_in_settlement} kostenlose/ausgenommene Buchungen.`,
      );
      let line = '';
      for (const word of note.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, 8) > W - 2 * M) {
          p.drawText(line, { x: M, y, size: 8, font, color: SOFT });
          y -= 11;
          line = word;
        } else line = next;
      }
      if (line) p.drawText(line, { x: M, y, size: 8, font, color: SOFT });
      y -= 20;
    } else {
      y = H - 50;
    }
    cols.forEach((c) => {
      const tw = bold.widthOfTextAtSize(c.t, 8);
      p.drawText(c.t, {
        x: c.right ? c.x + c.w - tw - 2 : c.x,
        y,
        size: 8,
        font: bold,
        color: SOFT,
      });
    });
    y -= 6;
    p.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: INK });
    return { p, y: y - 13 };
  };

  let { p, y } = newPage(true);
  for (const r of s.rows) {
    if (y < 70) ({ p, y } = newPage(false));
    const name = r.company_name ? `${r.name} · ${r.company_name}` : r.name;
    const cells = [
      de(r.date),
      `${r.start_time}–${r.end_time}`,
      r.booking_code,
      name,
      String(r.persons),
      r.checked_in ? 'ja' : 'nein',
      ...(admin ? [euro(r.amount_total_cents ?? 0)] : []),
      euro(r.haendler_share_cents),
    ];
    cells.forEach((text, i) => {
      const c = cols[i]!;
      const t = fit(text, font, 8.5, c.w);
      const tw = font.widthOfTextAtSize(t, 8.5);
      p.drawText(t, { x: c.right ? c.x + c.w - tw - 2 : c.x, y, size: 8.5, font, color: INK });
    });
    y -= 4;
    p.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
    y -= 11;
  }
  if (y < 80) ({ p, y } = newPage(false));
  y -= 4;
  const total = `Summe Anteil Händler: ${euro(s.haendler_cents)}`;
  p.drawText(safe(total), {
    x: W - M - bold.widthOfTextAtSize(safe(total), 11),
    y,
    size: 11,
    font: bold,
    color: INK,
  });

  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: LINE });
    pg.drawText(safe(SETTLEMENT_FOOTER), { x: M, y: 30, size: 8, font: bold, color: INK });
    const n = `Seite ${i + 1} von ${pages.length}`;
    pg.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 8), y: 30, size: 8, font, color: SOFT });
    pg.drawText('Weihnachtsmarkt-Lounge der Händler · Werbegemeinschaft Detmold e. V.', {
      x: M,
      y: 18,
      size: 7,
      font,
      color: SOFT,
    });
  });
  return pdf.save();
}
