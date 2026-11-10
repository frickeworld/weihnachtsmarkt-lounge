import { describe, expect, it } from 'vitest';
import { trafficSource } from './track';

const own = 'weihnachtslounge.studio-f.club';

describe('Herkunft der Seitenaufrufe', () => {
  it('utm_source aus dem Link hat Vorrang', () => {
    expect(trafficSource('?utm_source=Plakat%20A1', 'https://www.instagram.com/', own)).toBe(
      'plakata1',
    );
  });
  it('bekannte Verweise werden zusammengefasst', () => {
    expect(trafficSource('', 'https://l.instagram.com/?u=x', own)).toBe('instagram');
    expect(trafficSource('', 'https://m.facebook.com/', own)).toBe('facebook');
    expect(trafficSource('', 'https://www.google.de/', own)).toBe('google');
    expect(trafficSource('', 'https://www.weihnachtsmarkt-detmold.de/lounge/', own)).toBe(
      'weihnachtsmarkt-detmold.de',
    );
  });
  it('andere Seiten mit Domain, ohne Verweis oder von der eigenen Seite „direkt“', () => {
    expect(trafficSource('', 'https://www.lz.de/artikel', own)).toBe('lz.de');
    expect(trafficSource('', '', own)).toBe('direkt');
    expect(trafficSource('', `https://${own}/agb`, own)).toBe('direkt');
    expect(trafficSource('', 'kein-link', own)).toBe('direkt');
  });
});
