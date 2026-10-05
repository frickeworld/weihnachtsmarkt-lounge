import { describe, expect, it } from 'vitest';
import { buildProductJsonLd } from './structuredData';

describe('schema.org Product/AggregateOffer', () => {
  it('Preisspanne 99–199 EUR aus der Preisstaffel', () => {
    const j = buildProductJsonLd({
      siteUrl: 'https://lounge.example/',
      lowCents: 9900,
      highCents: 19900,
      offerCount: 21,
      maxTaler: 100,
      maxPersons: 10,
      seasonEnd: '2026-12-23',
    });
    expect(j.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '99.00',
      highPrice: '199.00',
      priceCurrency: 'EUR',
      url: 'https://lounge.example/#buchen',
    });
    expect(j.offers.seller.name).toBe('MF Coaching & Promotion GmbH');
  });
});
