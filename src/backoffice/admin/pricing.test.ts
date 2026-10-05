import { describe, expect, it } from 'vitest';
import { autoHaendlerShare } from './pricing';

describe('Händler-Anteil (automatisch)', () => {
  it.each([
    [9900, 50, 7275],
    [14900, 75, 11025],
    [19900, 100, 14775],
    [17850, 100, 13750],
  ])('%i Cent, %i € Freiverzehr → %i Cent', (total, taler, share) => {
    expect(autoHaendlerShare(total, 350, taler)).toBe(share);
  });
});
