import { describe, expect, it } from 'vitest';
import {
  maxTalerCount,
  minPriceCents,
  priceGroups,
  PUBLIC_SETTINGS_FALLBACK,
  talerLevels,
  weekdayLabel,
} from './settings';

describe('Preisstaffel', () => {
  const s = PUBLIC_SETTINGS_FALLBACK;

  it('ab 149 €, bis zu 100 € Freiverzehr, Stufen 75/100', () => {
    expect(minPriceCents(s)).toBe(14900);
    expect(maxTalerCount(s)).toBe(100);
    expect(talerLevels(s)).toEqual([75, 100]);
  });

  it('Wochentage lesbar zusammengefasst', () => {
    expect(weekdayLabel([1, 2, 3, 4])).toBe('Montag bis Donnerstag');
    expect(weekdayLabel([5, 6])).toBe('Freitag und Samstag');
    expect(weekdayLabel([7])).toBe('Sonntag');
    expect(weekdayLabel([1, 3, 5])).toBe('Montag, Mittwoch und Freitag');
  });

  it('Übersicht: Mo–Do, Fr–Sa, So mit zusammengefassten Abend-Zeiten', () => {
    const g = priceGroups(s.priceList);
    expect(g.map((x) => x.days)).toEqual([
      'Montag bis Donnerstag',
      'Freitag und Samstag',
      'Sonntag',
    ]);
    // Mo–Do nur abends (Nachmittag seit 07.10.2026 gestrichen)
    expect(g[0]!.rows).toEqual([
      { label: 'Abend', times: ['16:45–18:45', '19:00–21:00'], totalCents: 14900, talerCount: 75 },
    ]);
    expect(g[1]!.rows.map((r) => [r.totalCents, r.talerCount])).toEqual([
      [14900, 75],
      [19900, 100],
    ]);
    expect(g[2]!.rows.map((r) => r.totalCents)).toEqual([14900, 14900]);
  });
});
