import { describe, expect, it } from 'vitest';
import { buildProductJsonLd } from './structuredData';

describe('schema.org Product/Offer', () => {
  it('Gesamtpreis 178,50 EUR aus den Einstellungen', () => {
    const j = buildProductJsonLd({
      siteUrl: 'https://lounge.example/',
      totalCents: 17850,
      talerCount: 100,
      maxPersons: 10,
      seasonEnd: '2026-12-23',
    });
    expect(j.offers).toMatchObject({
      price: '178.50',
      priceCurrency: 'EUR',
      url: 'https://lounge.example/#buchen',
    });
    expect(j.offers.seller.name).toBe('MF Coaching & Promotion GmbH');
  });
});
