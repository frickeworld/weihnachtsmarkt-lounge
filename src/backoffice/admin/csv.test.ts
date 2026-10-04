import { describe, expect, it } from 'vitest';
import { csvEuro, toCsv } from './csv';
import { lastCutoff, parseEuroToCents, percent } from './format';

describe('toCsv', () => {
  it('setzt BOM, Semikolon und CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('﻿a;b\r\n1;x\r\n');
  });
  it('maskiert Trenner, Anführungszeichen und Zeilenumbrüche', () => {
    expect(toCsv(['n'], [['Müller; "Max"\nGmbH']])).toBe('﻿n\r\n"Müller; ""Max""\nGmbH"\r\n');
  });
  it('entschärft Formeln (CSV-Injection)', () => {
    expect(toCsv(['n'], [['=HYPERLINK("x")'], ['+49 123'], ['@SUM']])).toBe(
      '﻿n\r\n"\'=HYPERLINK(""x"")"\r\n\'+49 123\r\n\'@SUM\r\n',
    );
  });
  it('leere Werte bleiben leer', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('﻿a;b\r\n;\r\n');
  });
  it('Euro mit Komma', () => {
    expect(csvEuro(17850)).toBe('178,50');
    expect(csvEuro(0)).toBe('0,00');
  });
});

describe('parseEuroToCents', () => {
  it.each([
    ['175', 17500],
    ['175,5', 17550],
    ['178,50 €', 17850],
    ['1.234,56', 123456],
    ['0', 0],
  ])('%s → %i', (input, cents) => expect(parseEuroToCents(input)).toBe(cents));
  it.each(['', 'abc', '1,234', '12.5', '-3'])('lehnt %s ab', (input) =>
    expect(parseEuroToCents(input)).toBeNull(),
  );
});

describe('percent', () => {
  it('rundet auf eine Stelle', () => {
    expect(percent(1, 3)).toBe('33,3 %');
    expect(percent(0, 0)).toBe('–');
  });
});

describe('lastCutoff', () => {
  it('nimmt den letzten vergangenen 31. März', () => {
    expect(lastCutoff('2026-10-04')).toBe('2026-03-31');
    expect(lastCutoff('2027-03-31')).toBe('2027-03-31');
    expect(lastCutoff('2027-03-30')).toBe('2026-03-31');
  });
});
