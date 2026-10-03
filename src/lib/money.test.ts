import { describe, expect, it } from 'vitest';
import { formatCents } from './money';

describe('formatCents', () => {
  it('formatiert den Gesamtpreis deutsch', () => {
    expect(formatCents(17850).replace(/\s/g, ' ')).toBe('178,50 €');
  });

  it('lehnt Bruchteile von Cent ab', () => {
    expect(() => formatCents(1.5)).toThrow();
  });
});
