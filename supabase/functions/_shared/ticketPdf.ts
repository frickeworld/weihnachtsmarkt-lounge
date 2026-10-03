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
  logoPng?: Uint8Array | null;
}

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const NIGHT = hex('#0F0D0B');
const GOLD = hex('#C9A24D');
const CREAM = hex('#F6EFE3');
const CHAMPAGNE = hex('#E9D8A6');
const MUTED = hex('#BDB3A3');

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
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);

  const center = (text: string, y: number, font = sans, size = 10, color = CREAM) => {
    const t = safe(text);
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  // Hintergrund und Goldrahmen
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NIGHT });
  page.drawRectangle({
    x: 14,
    y: 14,
    width: W - 28,
    height: H - 28,
    borderColor: GOLD,
    borderWidth: 1,
  });

  // Logo-Plakette
  let y = H - 40;
  if (d.logoPng) {
    const logo = await pdf.embedPng(d.logoPng);
    const lw = 170;
    const lh = (logo.height / logo.width) * lw;
    page.drawRectangle({
      x: (W - lw) / 2 - 10,
      y: y - lh - 10,
      width: lw + 20,
      height: lh + 20,
      color: CREAM,
      borderColor: GOLD,
      borderWidth: 1,
    });
    page.drawImage(logo, { x: (W - lw) / 2, y: y - lh, width: lw, height: lh });
    y -= lh + 34;
  } else {
    center('DIE HÄNDLER', y - 14, sansBold, 16, CHAMPAGNE);
    y -= 40;
  }

  center('WEIHNACHTSMARKT IM SCHLOSSPARK DETMOLD', y, sans, 8, CHAMPAGNE);
  y -= 26;
  center('Weihnachtsmarkt-Lounge', y, serif, 22, CREAM);
  y -= 30;
  center(d.dateLabel, y, serifBold, 17, CHAMPAGNE);
  y -= 20;
  center(`${d.startTime}–${d.endTime} Uhr`, y, sans, 13, CREAM);

  // QR-Code auf weißem Feld
  const qrSize = 170;
  y -= qrSize + 30;
  page.drawRectangle({
    x: (W - qrSize) / 2 - 10,
    y: y - 10,
    width: qrSize + 20,
    height: qrSize + 20,
    color: rgb(1, 1, 1),
  });
  const qr = await pdf.embedPng(d.qrPng);
  page.drawImage(qr, { x: (W - qrSize) / 2, y, width: qrSize, height: qrSize });

  y -= 28;
  center(d.bookingCode, y, mono, 15, CREAM);
  y -= 16;
  center(
    `Für ${d.firstName} · ${d.persons} ${d.persons === 1 ? 'Person' : 'Personen'}`,
    y,
    sans,
    9,
    MUTED,
  );

  // Hinweise
  y -= 26;
  const notes = [
    `${d.talerCount} Residenztaler beim Einlass – je 1 €, pro gekauftem Artikel 1 Taler.`,
    'Tischservice der Tanzschule Fricke an eurem Platz.',
    `Ort: ${d.location}`,
    `Bitte sei pünktlich – dein Zeitfenster endet um ${d.endTime} Uhr.`,
    'Die Buchung ist verbindlich. Das Ticket ist übertragbar.',
  ];
  for (const n of notes) {
    for (const line of wrap(n, 80)) {
      center(line, y, sans, 8.5, CREAM);
      y -= 12;
    }
  }

  // Fußzeile
  const legal = wrap(legalLine(), 95);
  let fy = 30 + legal.length * 9;
  center(
    'Eine Aktion der Händler – Werbegemeinschaft Detmold e. V. · Powered by STUDIO/F',
    fy + 4,
    sans,
    6.5,
    MUTED,
  );
  for (const line of legal) {
    fy -= 9;
    center(line, fy, sans, 6.5, MUTED);
  }

  return await pdf.save();
}
