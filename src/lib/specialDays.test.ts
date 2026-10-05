import { describe, expect, it } from 'vitest';
import { adventOf, fourthAdvent, specialDay, ticketDayNote } from './specialDays';

const S = '2026-11-26';
const E = '2026-12-23';

describe('specialDays', () => {
  it('Adventssonntage 2026: 29.11., 6.12., 13.12., 20.12.', () => {
    expect(fourthAdvent(2026)).toBe('2026-12-20');
    expect(adventOf('2026-11-29')).toBe(1);
    expect(adventOf('2026-12-05')).toBe(1);
    expect(adventOf('2026-12-06')).toBe(2);
    expect(adventOf('2026-12-23')).toBe(4);
    expect(adventOf('2026-11-28')).toBe(0);
    expect(fourthAdvent(2027)).toBe('2027-12-19');
  });
  it('Eröffnung, Nikolaus am 2. Advent, letzter Tag', () => {
    expect(specialDay(S, S, E)?.kind).toBe('opening');
    expect(specialDay('2026-12-06', S, E)).toMatchObject({
      kind: 'nikolaus',
      title: 'Frohen Nikolaus und schönen 2. Advent',
    });
    expect(specialDay('2026-12-13', S, E)).toMatchObject({ kind: 'advent', advent: 3 });
    expect(specialDay(E, S, E)?.kind).toBe('last');
    expect(specialDay('2026-12-15', S, E)).toEqual({ kind: 'adventWeek', advent: 3 });
    expect(specialDay('2026-11-27', S, E)).toBeNull();
  });
  it('außerhalb der Saison nichts, auch kein Silvester', () => {
    expect(specialDay('2026-12-31', S, E)).toBeNull();
    expect(specialDay('2026-12-24', S, E)).toBeNull();
  });
  it('Hinweis auf dem Ticket', () => {
    expect(ticketDayNote('2026-12-20', S, E)).toBe('Dein Termin fällt auf den 4. Advent.');
    expect(ticketDayNote('2026-12-15', S, E)).toBeNull();
  });
});
