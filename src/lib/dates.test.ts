import { describe, expect, it } from 'vitest';
import { addDays, formatLongDate, isoWeekday, monthGrid, todayInBerlin } from './dates';

describe('dates', () => {
  it('rechnet ISO-Wochentage (Mo = 1, So = 7)', () => {
    expect(isoWeekday('2026-11-30')).toBe(1);
    expect(isoWeekday('2026-12-06')).toBe(7);
  });

  it('addiert Tage über Monatsgrenzen', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('baut den Dezember 2026 mit Montag als erstem Tag', () => {
    const grid = monthGrid(2026, 12);
    expect(grid[0]).toEqual([
      null,
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ]);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });

  it('nutzt für "heute" die Berliner Zeit', () => {
    // 23:30 UTC am 30.11. ist in Berlin bereits der 1.12.
    expect(todayInBerlin(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01');
  });

  it('formatiert deutsch', () => {
    expect(formatLongDate('2026-12-05')).toBe('Samstag, 5. Dezember 2026');
  });
});
