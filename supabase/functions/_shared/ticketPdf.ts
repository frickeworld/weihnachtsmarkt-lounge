// PDF-Ticket (A5 hoch) mit pdf-lib. Standard-Schriften (WinAnsi) decken Umlaute, ß und € ab.
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { legalLine } from './legal.ts';

export interface TicketPdfData {
  firstName: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  persons: number;
  bookingCode: string;
  location: string;
  talerCount: number;
  qrPng: Uint8Array;
  /** Glitzer-Kopf mit Markt-Schriftzug (JPEG), optional */
  headerJpg?: Uint8Array | null;
  /** Händler-Logo weiß (PNG), optional – steht auf dem dunklen Fuß */
  logoPng?: Uint8Array | null;
}

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
// Helles Design (Design-Runde 2)
const PAPER = hex('#FBF7EF');
const LINE = hex('#E4D8C2');
const INK = hex('#23201B');
const INK_SOFT = hex('#5F574B');
const GOLD = hex('#C6A45C');
const GOLD_DEEP = hex('#7A5A1E');
const BROWN = hex('#24221E');
const ON_DARK = hex('#F8F3E8');

/** Entfernt Zeichen, die WinAnsi nicht kann (z. B. Emojis in Namen), statt abzustürzen. */
function safe(text: string): string {
  return text.replace(/[^ -~ -ÿ€„“”–—…•]/g, '');
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderTicketPdf(d: TicketPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ticket ${d.bookingCode} – Weihnachtsmarkt-Lounge`);
  pdf.setAuthor('Weihnachtsmarkt-Lounge der Händler');
  pdf.setLanguage('de-DE');

  const W = 420;
  const H = 595;
  const page = pdf.addPage([W, H]);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);

  const center = (text: string, y: number, font = sans, size = 10, color = INK) => {
    const t = safe(text);
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  // Hintergrund
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });

  // Kopf: Gold-Glitzer mit Markt-Schriftzug
  const headH = 84;
  if (d.headerJpg) {
    const head = await pdf.embedJpg(d.headerJpg);
    page.drawImage(head, { x: 0, y: H - headH, width: W, height: headH });
  } else {
    page.drawRectangle({ x: 0, y: H - headH, width: W, height: headH, color: GOLD });
    center('Weihnachtsmarkt im Schlosspark Detmold', H - headH / 2 - 5, serifBold, 15, INK);
  }

  // Fuß: dunkelbraun mit weißem Händler-Logo und Kurz-Impressum
  const footH = 74;
  page.drawRectangle({ x: 0, y: 0, width: W, height: footH, color: BROWN });

  let y = H - headH - 30;
  center('DEIN TICKET FÜR DIE LOUNGE', y, sansBold, 8.5, GOLD_DEEP);
  y -= 26;
  center(d.dateLabel, y, sansBold, 18, INK);
  y -= 20;
  center(`${d.startTime}–${d.endTime} Uhr`, y, sansBold, 13, GOLD_DEEP);

  // QR-Code auf weißem Feld
  const qrSize = 168;
  y -= qrSize + 26;
  page.drawRectangle({
    x: (W - qrSize) / 2 - 10,
    y: y - 10,
    width: qrSize + 20,
    height: qrSize + 20,
    color: rgb(1, 1, 1),
    borderColor: LINE,
    borderWidth: 1,
  });
  const qr = await pdf.embedPng(d.qrPng);
  page.drawImage(qr, { x: (W - qrSize) / 2, y, width: qrSize, height: qrSize });

  y -= 30;
  center(d.bookingCode, y, mono, 15, INK);
  y -= 16;
  center(
    `Für ${d.firstName} · ${d.persons} ${d.persons === 1 ? 'Person' : 'Personen'}`,
    y,
    sans,
    9,
    INK_SOFT,
  );

  // Hervorgehoben: Freiverzehr
  y -= 30;
  const boxW = 300;
  page.drawRectangle({ x: (W - boxW) / 2, y: y - 8, width: boxW, height: 26, color: GOLD });
  center(
    `${d.talerCount} € Freiverzehr inklusive – ${d.talerCount} Residenztaler beim Einlass`,
    y,
    sansBold,
    8.5,
    INK,
  );

  // Hinweise
  y -= 24;
  const notes = [
    'Je 1 € pro Taler, an den Ständen einlösbar – pro gekauftem Artikel 1 Taler.',
    'Tischservice der Tanzschule Fricke an eurem Platz.',
    `Ort: ${d.location}`,
    `Bitte sei pünktlich – dein Zeitfenster endet um ${d.endTime} Uhr.`,
    'Die Buchung ist verbindlich. Das Ticket ist übertragbar.',
  ];
  for (const n of notes) {
    for (const line of wrap(n, 80)) {
      center(line, y, sans, 8.5, INK);
      y -= 12;
    }
  }

  // Fuß-Inhalt
  if (d.logoPng) {
    const logo = await pdf.embedPng(d.logoPng);
    const lw = 110;
    const lh = (logo.height / logo.width) * lw;
    page.drawImage(logo, { x: 22, y: footH - lh - 14, width: lw, height: lh });
  }
  const legal = wrap(legalLine(), 62);
  let fy = footH - 18;
  const textX = 150;
  page.drawText(safe('Eine Aktion der Händler – Werbegemeinschaft Detmold e. V.'), {
    x: textX,
    y: fy,
    size: 6.5,
    font: sansBold,
    color: ON_DARK,
  });
  for (const line of legal) {
    fy -= 9;
    page.drawText(safe(line), { x: textX, y: fy, size: 6.2, font: sans, color: ON_DARK });
  }
  page.drawText('Powered by STUDIO/F', {
    x: textX,
    y: fy - 11,
    size: 6.2,
    font: sans,
    color: ON_DARK,
  });

  return await pdf.save();
}

export interface GiftPdfData extends TicketPdfData {
  /** Weihnachtsmarkt-Taler (PNG mit Transparenz), optional */
  talerPng?: Uint8Array | null;
}

/**
 * Geschenk-Karte: Seite 1 zum Verschenken (Termin, Freiverzehr, Felder „Für“ und „Von“ zum
 * Ausfüllen), Seite 2 das Ticket mit QR-Code. Das Ticket ist übertragbar.
 */
export async function renderGiftPdf(d: GiftPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Geschenk – Weihnachtsmarkt-Lounge ${d.bookingCode}`);
  pdf.setAuthor('Weihnachtsmarkt-Lounge der Händler');
  pdf.setLanguage('de-DE');

  const W = 420;
  const H = 595;
  const page = pdf.addPage([W, H]);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const center = (text: string, y: number, font = sans, size = 10, color = INK) => {
    const t = safe(text);
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  // Doppelter Goldrahmen
  page.drawRectangle({
    x: 16,
    y: 16,
    width: W - 32,
    height: H - 32,
    borderColor: GOLD,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 24,
    y: 24,
    width: W - 48,
    height: H - 48,
    borderColor: GOLD,
    borderWidth: 0.8,
  });
  // Sterne in den Ecken
  for (const [x, y] of [
    [40, H - 40],
    [W - 40, H - 40],
    [40, 40],
    [W - 40, 40],
  ] as const) {
    page.drawCircle({ x, y, size: 3.2, color: GOLD });
  }

  let y = H - 70;
  if (d.headerJpg) {
    const head = await pdf.embedJpg(d.headerJpg);
    const hw = W - 64;
    const hh = 64;
    page.drawImage(head, { x: 32, y: y - hh + 14, width: hw, height: hh });
    y -= hh + 14;
  }
  y -= 20;
  center('EIN GESCHENK FÜR DICH', y, sansBold, 9, GOLD_DEEP);
  y -= 40;
  center('Ein Abend in der Lounge', y, serifBold, 26, INK);
  y -= 24;
  center('auf dem Weihnachtsmarkt im Schlosspark Detmold', y, serifItalic, 12.5, INK_SOFT);

  if (d.talerPng) {
    const taler = await pdf.embedPng(d.talerPng);
    const s = 92;
    y -= s + 22;
    page.drawImage(taler, { x: (W - s) / 2, y, width: s, height: s });
  } else y -= 40;

  y -= 30;
  center(d.dateLabel, y, sansBold, 16, INK);
  y -= 19;
  center(
    `${d.startTime}–${d.endTime} Uhr · bis zu ${d.persons} Personen`,
    y,
    sansBold,
    11.5,
    GOLD_DEEP,
  );
  y -= 30;
  const boxW = 290;
  page.drawRectangle({ x: (W - boxW) / 2, y: y - 9, width: boxW, height: 28, color: GOLD });
  center(`inklusive ${d.talerCount} € Freiverzehr und Tischservice`, y, sansBold, 10, INK);

  // Felder zum Ausfüllen
  y -= 50;
  for (const label of ['Für', 'Von']) {
    page.drawText(label, { x: 70, y, size: 12, font: serifItalic, color: INK_SOFT });
    page.drawLine({
      start: { x: 100, y: y - 2 },
      end: { x: W - 70, y: y - 2 },
      thickness: 0.8,
      color: LINE,
    });
    y -= 34;
  }

  y -= 4;
  center('Das Ticket mit QR-Code liegt auf der nächsten Seite.', y, sans, 8.5, INK_SOFT);
  y -= 12;
  center('Einfach mitbringen und am Einlass zeigen.', y, sans, 8.5, INK_SOFT);
  center('Powered by STUDIO/F', 34, sans, 6.5, INK_SOFT);

  // Seite 2: das Ticket
  const ticket = await PDFDocument.load(await renderTicketPdf(d));
  const [ticketPage] = await pdf.copyPages(ticket, [0]);
  pdf.addPage(ticketPage);

  return await pdf.save();
}
