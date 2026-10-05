import { describe, expect, it } from 'vitest';
import { heatStep } from './heatStep';

describe('heatStep', () => {
  it('ordnet die Auslastung fünf Stufen zu', () => {
    expect(heatStep(0, 10)).toBe(0);
    expect(heatStep(3, 0)).toBe(0);
    expect(heatStep(2, 10)).toBe(1);
    expect(heatStep(5, 10)).toBe(2);
    expect(heatStep(7, 10)).toBe(3);
    expect(heatStep(10, 10)).toBe(4);
  });
});
