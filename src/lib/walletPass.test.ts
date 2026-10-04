import { describe, expect, it } from 'vitest';
import { berlinIso } from '../../supabase/functions/_shared/format.ts';

describe('berlinIso', () => {
  it('Winterzeit +01:00', () => {
    expect(berlinIso('2026-12-05', '17:30')).toBe('2026-12-05T17:30:00+01:00');
  });
  it('Sommerzeit +02:00', () => {
    expect(berlinIso('2026-07-01', '19:00:00')).toBe('2026-07-01T19:00:00+02:00');
  });
  it('Tag der Zeitumstellung', () => {
    expect(berlinIso('2026-10-25', '17:00')).toBe('2026-10-25T17:00:00+01:00');
    expect(berlinIso('2026-03-29', '17:00')).toBe('2026-03-29T17:00:00+02:00');
  });
});
