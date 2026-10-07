import { describe, expect, it } from 'vitest';
import { scarcityMessage } from './scarcity';

describe('scarcityMessage', () => {
  it('nichts, solange genug frei ist', () => {
    expect(scarcityMessage({ freeTotal: 80, offeredTotal: 100, freeWeekendEve: 20 })).toBeNull();
    expect(scarcityMessage(null)).toBeNull();
    expect(scarcityMessage({ freeTotal: 0, offeredTotal: 100, freeWeekendEve: 0 })).toBeNull();
  });
  it('Wochenend-Abende zuerst', () => {
    expect(scarcityMessage({ freeTotal: 40, offeredTotal: 100, freeWeekendEve: 3 })).toBe(
      'Nur noch 3 Abende am Wochenende frei',
    );
    expect(scarcityMessage({ freeTotal: 40, offeredTotal: 100, freeWeekendEve: 1 })).toBe(
      'Nur noch 1 Abend am Wochenende frei',
    );
  });
  it('wenige Termine insgesamt oder Wochenende voll', () => {
    expect(scarcityMessage({ freeTotal: 12, offeredTotal: 100, freeWeekendEve: 10 })).toBe(
      'Nur noch 12 Termine frei',
    );
    expect(scarcityMessage({ freeTotal: 30, offeredTotal: 100, freeWeekendEve: 0 })).toBe(
      'Wochenend-Abende ausgebucht – unter der Woche ist noch Platz',
    );
  });
});
