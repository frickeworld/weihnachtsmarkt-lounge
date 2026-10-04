import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { periodLabel, settlementCsv, settlementPdf } from './exports';
import type { Settlement, SettlementRow } from './types';

const row = (over: Partial<SettlementRow> = {}): SettlementRow => ({
  date: '2026-12-01',
  start_time: '17:00',
  end_time: '19:00',
  booking_code: 'HL-ABCD-EFGH',
  name: 'Erika Müller',
  company_name: 'Müller & Söhne GmbH',
  persons: 6,
  source: 'online',
  checked_in: true,
  haendler_share_cents: 13750,
  amount_total_cents: null,
  ...over,
});

const haendler: Settlement = {
  from: '2026-11-26',
  to: '2026-12-23',
  count: 2,
  haendler_cents: 27500,
  revenue_cents: null,
  studio_cents: null,
  no_shows: 1,
  excluded_cancelled: 1,
  excluded_not_in_settlement: 0,
  rows: [
    row(),
    row({
      booking_code: 'HL-ZZZZ-ZZZZ',
      name: 'Nico 🎄 Nichtda',
      company_name: null,
      checked_in: false,
    }),
  ],
};

describe('Abrechnung CSV', () => {
  it('Händler: Einzelaufstellung und Summe 275,00 €, ohne Gesamtbetrag', () => {
    const csv = settlementCsv(haendler);
    expect(
      csv.startsWith(
        '﻿Datum;Beginn;Ende;Buchungscode;Name;Firma;Personen;Erschienen;Händler-Anteil €\r\n',
      ),
    ).toBe(true);
    expect(csv).toContain(
      '01.12.2026;17:00;19:00;HL-ABCD-EFGH;Erika Müller;Müller & Söhne GmbH;6;ja;137,50',
    );
    expect(csv).toContain(';nein;137,50');
    expect(csv.trimEnd().split('\r\n').at(-1)).toBe('Summe;;;2 Buchungen;;;;;275,00');
    expect(csv).not.toContain('Studio F');
  });

  it('Admin: zusätzlich Gesamt und Studio F', () => {
    const csv = settlementCsv({
      ...haendler,
      revenue_cents: 35700,
      studio_cents: 8200,
      rows: haendler.rows.map((r) => ({ ...r, amount_total_cents: 17850 })),
    });
    expect(csv).toContain('Gesamt €;Studio F €');
    expect(csv).toContain(';137,50;178,50;41,00');
    expect(csv).toContain(';275,00;357,00;82,00');
  });
});

describe('Abrechnung PDF', () => {
  it('erzeugt ein PDF mit Titel, auch mit Emojis im Namen', async () => {
    const bytes = await settlementPdf(haendler);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe(
      `Abrechnungsübersicht Weihnachtsmarkt-Lounge ${periodLabel(haendler)}`,
    );
    expect(doc.getPageCount()).toBe(1);
  });

  it('bricht lange Listen auf mehrere Seiten um', async () => {
    const many = {
      ...haendler,
      rows: Array.from({ length: 120 }, (_, i) => row({ booking_code: `HL-${i}` })),
    };
    const doc = await PDFDocument.load(await settlementPdf(many));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });
});
