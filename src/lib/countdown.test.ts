import { describe, expect, it } from 'vitest';
import { countdown } from './countdown';

describe('countdown', () => {
  it('zählt bis zum Beginn in Berliner Zeit', () => {
    // 05.12.2026 17:45 Berlin = 16:45 UTC
    expect(countdown('2026-12-05', '17:45', '19:45', new Date('2026-12-03T14:44:30Z'))).toEqual({
      phase: 'before',
      days: 2,
      hours: 2,
      minutes: 0,
      seconds: 30,
    });
  });
  it('läuft während des Zeitfensters, danach vorbei', () => {
    expect(countdown('2026-12-05', '17:45', '19:45', new Date('2026-12-05T17:00:00Z'))).toEqual({
      phase: 'running',
    });
    expect(countdown('2026-12-05', '17:45', '19:45', new Date('2026-12-05T18:45:00Z'))).toEqual({
      phase: 'over',
    });
  });
});
