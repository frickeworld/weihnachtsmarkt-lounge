import { describe, expect, it } from 'vitest';
import { autoHaendlerShare } from './pricing';

describe('Händler-Anteil (automatisch)', () => {
  it.each([
    [10395, 50, 7128],
    [15645, 75, 10728],
    [20895, 100, 14328],
    [19845, 100, 13608],
    [31395, 150, 21528],
  ])('5 %%, 72 %% an die Händler: %i Cent, %i € Freiverzehr → %i Cent', (total, taler, share) => {
    expect(autoHaendlerShare(total, { feeCents: 350, feePercent: 5 }, taler)).toBe(share);
  });

  it.each([
    [9900, 50, 6876], // (99 € − 3,50 €) × 72 %
    [14900, 75, 10476],
    [19900, 100, 14076],
  ])('fest 3,50 €: %i Cent, %i € Freiverzehr → %i Cent', (total, taler, share) => {
    expect(autoHaendlerShare(total, { feeCents: 350, feePercent: null }, taler)).toBe(share);
  });

  it('nie weniger als der Freiverzehr', () => {
    // 100 € Lounge mit 90 € Freiverzehr: 72 % wären 72 € → Händler bekommen 90 €
    expect(autoHaendlerShare(10500, { feeCents: 0, feePercent: 5 }, 90)).toBe(9000);
  });

  it('Anteil aus den Einstellungen', () => {
    expect(autoHaendlerShare(20895, { feeCents: 0, feePercent: 5, studioPercent: 30 }, 100)).toBe(
      13930,
    );
  });
});
