import { describe, expect, it } from 'vitest';
import {
  feeFor,
  feeLabel,
  feeNote,
  loungeCents,
  maxTalerCount,
  minLoungeCents,
  minPriceCents,
  priceGroups,
  PUBLIC_SETTINGS_FALLBACK,
  talerLevels,
  weekdayLabel,
} from './settings';

describe('Preisstaffel', () => {
  const s = PUBLIC_SETTINGS_FALLBACK;

  it('ab 104 € Endpreis = ab 99 € Lounge-Preis, bis zu 100 € Freiverzehr, Stufen 50/75/100', () => {
    expect(minPriceCents(s)).toBe(10400);
    expect(minLoungeCents(s)).toBe(9900);
    expect(loungeCents(20900, s)).toBe(19900);
    expect(loungeCents(19800, s)).toBe(18900);
    expect(feeNote(s)).toBe('zzgl. 5 % Vorverkaufsgebühr');
    expect(maxTalerCount(s)).toBe(100);
    expect(talerLevels(s)).toEqual([50, 75, 100]);
  });

  it('Wochentage lesbar zusammengefasst', () => {
    expect(weekdayLabel([1, 2, 3, 4])).toBe('Montag bis Donnerstag');
    expect(weekdayLabel([5, 6])).toBe('Freitag und Samstag');
    expect(weekdayLabel([7])).toBe('Sonntag');
    expect(weekdayLabel([1, 3, 5])).toBe('Montag, Mittwoch und Freitag');
  });

  it('Übersicht: Mo–Do, Fr–Sa, So – je Zeitfenster eine Zeile', () => {
    const g = priceGroups(s.priceList);
    expect(g.map((x) => x.days)).toEqual([
      'Montag bis Donnerstag',
      'Freitag und Samstag',
      'Sonntag',
    ]);
    // Mo–Do: Nachmittag 104 €, abends 156 € (Lounge-Preis + 5 %)
    expect(g[0]!.rows).toEqual([
      { label: 'Nachmittag', times: ['14:30–16:30'], totalCents: 10400, talerCount: 50 },
      { label: 'Früher Abend', times: ['16:45–18:45'], totalCents: 15600, talerCount: 75 },
      { label: 'Später Abend', times: ['19:00–21:00'], totalCents: 15600, talerCount: 75 },
    ]);
    expect(g[1]!.rows.map((r) => [r.label, r.totalCents, r.talerCount])).toEqual([
      ['Nachmittag', 15600, 75],
      ['Früher Abend', 20900, 100],
      ['Später Abend', 20900, 100],
    ]);
    expect(g[2]!.rows.map((r) => r.label)).toEqual(['Nachmittag', 'Früher Abend', 'Später Abend']);
  });
});

describe('Verkaufsgebühr 5 %', () => {
  it.each([
    [10400, 500],
    [15600, 700],
    [20900, 1000],
    [19800, 900],
    [31400, 1500],
  ])('%i Cent enthalten %i Cent Gebühr', (total, fee) => {
    expect(feeFor(total, { feeCents: 350, feePercent: 5 })).toBe(fee);
  });
  it('ohne Prozentsatz gilt der feste Betrag', () => {
    expect(feeFor(14900, { feeCents: 350, feePercent: null })).toBe(350);
    expect(feeLabel({ feeCents: 350, feePercent: null })).toMatch(/^3,50\s€$/);
    expect(feeLabel({ feeCents: 350, feePercent: 5 })).toBe('5 %');
  });
});
