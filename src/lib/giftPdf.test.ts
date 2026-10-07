import { readFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { renderGiftPdf } from '../../supabase/functions/_shared/ticketPdf';

describe('Geschenk-Karte', () => {
  it('zwei Seiten: Geschenk und Ticket', async () => {
    const qrPng = await QRCode.toBuffer('Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z', { type: 'png' });
    const bytes = await renderGiftPdf({
      firstName: 'Anna',
      dateLabel: 'Samstag, 5. Dezember 2026',
      startTime: '17:45',
      endTime: '19:45',
      persons: 8,
      bookingCode: 'HL-ABCD-EFGH',
      location: 'Weihnachtsmarkt im Schlosspark, Detmold',
      talerCount: 100,
      qrPng: new Uint8Array(qrPng),
      talerPng: new Uint8Array(await readFile('public/email/taler.png')),
    });
    if (process.env.GIFT_PDF_OUT) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(process.env.GIFT_PDF_OUT, bytes);
    }
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe('Geschenk – Weihnachtsmarkt-Lounge HL-ABCD-EFGH');
  });
});
