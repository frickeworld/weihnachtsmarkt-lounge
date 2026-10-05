import { LEGAL_SHORT } from '../../supabase/functions/_shared/legal.ts';

/** schema.org Product mit Preisspanne (Preisstaffel je Zeitfenster), Werte aus den Einstellungen. */
export function buildProductJsonLd(opts: {
  siteUrl: string;
  lowCents: number;
  highCents: number;
  offerCount: number;
  maxTaler: number;
  maxPersons: number;
  seasonEnd: string;
}) {
  const site = opts.siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Weihnachtsmarkt-Lounge der Händler',
    description: `Überdachte Lounge auf dem Weihnachtsmarkt im Schlosspark Detmold: 2 Stunden exklusiv, bis zu ${opts.maxPersons} Personen, bis zu ${opts.maxTaler} € Freiverzehr in Residenztalern und Tischservice.`,
    image: `${site}/og-image.png`,
    brand: { '@type': 'Brand', name: 'Die Händler – Werbegemeinschaft Detmold' },
    offers: {
      '@type': 'AggregateOffer',
      url: `${site}/#buchen`,
      lowPrice: (opts.lowCents / 100).toFixed(2),
      highPrice: (opts.highCents / 100).toFixed(2),
      offerCount: opts.offerCount,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      priceValidUntil: opts.seasonEnd,
      seller: { '@type': 'Organization', name: LEGAL_SHORT.company },
    },
  };
}
