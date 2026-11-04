import { describe, expect, it } from 'vitest';
import { formatDrawTime, remaining, shortCountdown } from './drawCountdown';

describe('Countdown bis zur Gewinnspiel-Ziehung', () => {
  const target = '2026-12-06T17:00:00Z'; // Sonntag, 6.12., 18:00 Uhr Berlin

  it('rechnet Tage, Stunden, Minuten, Sekunden', () => {
    const now = new Date('2026-12-03T11:57:51Z').getTime();
    expect(remaining(target, now)).toEqual({
      done: false,
      days: 3,
      hours: 5,
      minutes: 2,
      seconds: 9,
    });
    expect(shortCountdown(remaining(target, now))).toBe('3 T 05:02:09');
  });

  it('nach der Ziehung: fertig, nie negativ', () => {
    const r = remaining(target, new Date('2026-12-06T17:00:01Z').getTime());
    expect(r.done).toBe(true);
    expect(r.days + r.hours + r.minutes + r.seconds).toBe(0);
  });

  it('Zeitpunkt in Berliner Zeit', () => {
    expect(formatDrawTime(target)).toBe('Sonntag, 6. Dezember, 18:00 Uhr');
  });
});
