import { describe, expect, it } from 'vitest';
import { dayStatus, type SlotAvailability } from './availability';
import { slotsForDate } from './slots';

const slot = (status: SlotAvailability['status'], startTime = '17:00'): SlotAvailability => ({
  date: '2026-12-01',
  startTime,
  endTime: '19:00',
  status,
});

describe('Zeitfenster', () => {
  it('Mo–Fr 17:00 und 19:00', () => {
    expect(slotsForDate('2026-12-02').map((s) => `${s.startTime}–${s.endTime}`)).toEqual([
      '17:00–19:00',
      '19:00–21:00',
    ]);
  });

  it('Sa–So 17:30 und 19:30', () => {
    expect(slotsForDate('2026-12-05').map((s) => `${s.startTime}–${s.endTime}`)).toEqual([
      '17:30–19:30',
      '19:30–21:30',
    ]);
  });
});

describe('dayStatus', () => {
  it('frei, wenn beide Zeitfenster frei sind', () => {
    expect(dayStatus([slot('free'), slot('free', '19:00')])).toBe('free');
  });
  it('nur noch 1 Zeitfenster', () => {
    expect(dayStatus([slot('taken'), slot('free', '19:00')])).toBe('last');
    expect(dayStatus([slot('past'), slot('free', '19:00')])).toBe('last');
  });
  it('ausgebucht', () => {
    expect(dayStatus([slot('taken'), slot('blocked', '19:00')])).toBe('booked');
  });
  it('geschlossen', () => {
    expect(dayStatus([slot('closed'), slot('closed', '19:00')])).toBe('closed');
  });
  it('außerhalb der Saison oder vergangen ist nicht wählbar', () => {
    expect(dayStatus([slot('out_of_season'), slot('out_of_season', '19:00')])).toBe('unavailable');
    expect(dayStatus([slot('past'), slot('past', '19:00')])).toBe('unavailable');
  });
});
