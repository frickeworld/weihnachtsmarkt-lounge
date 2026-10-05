import { describe, expect, it } from 'vitest';
import { dayStatus, type SlotAvailability } from './availability';

const slot = (status: SlotAvailability['status'], startTime = '17:00'): SlotAvailability => ({
  date: '2026-12-01',
  startTime,
  endTime: '19:00',
  status,
});

describe('dayStatus', () => {
  it('frei, wenn beide Zeitfenster frei sind', () => {
    expect(dayStatus([slot('free'), slot('free', '19:00')])).toBe('free');
  });
  it('nur noch 1 Zeitfenster', () => {
    expect(dayStatus([slot('taken'), slot('free', '19:00')])).toBe('last');
    expect(dayStatus([slot('past'), slot('free', '19:00')])).toBe('last');
    expect(dayStatus([slot('taken', '14:30'), slot('free', '16:45'), slot('free', '19:00')])).toBe(
      'free',
    );
    expect(dayStatus([slot('taken', '14:30'), slot('taken', '16:45'), slot('free', '19:00')])).toBe(
      'last',
    );
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
