import { describe, expect, it } from 'vitest';
import { autoHaendlerShare } from './pricing';

describe('Händler-Anteil (automatisch)', () => {
  it.each([
    [10395, 50, 7450],
    [15645, 75, 11200],
    [20895, 100, 14950],
    [19845, 100, 14450],
    [31395, 150, 22450],
  ])('5 %%: %i Cent, %i € Freiverzehr → %i Cent', (total, taler, share) => {
    expect(autoHaendlerShare(total, { feeCents: 350, feePercent: 5 }, taler)).toBe(share);
  });

  it.each([
    [9900, 50, 7275],
    [14900, 75, 11025],
    [19900, 100, 14775],
  ])('fest 3,50 €: %i Cent, %i € Freiverzehr → %i Cent', (total, taler, share) => {
    expect(autoHaendlerShare(total, { feeCents: 350, feePercent: null }, taler)).toBe(share);
  });
});
