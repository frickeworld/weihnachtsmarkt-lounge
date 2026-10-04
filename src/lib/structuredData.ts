import { LEGAL_SHORT } from '../../supabase/functions/_shared/legal.ts';

/** schema.org Product/Offer für Suchmaschinen. Preis immer aus den Einstellungen (Gesamtpreis). */
export function buildProductJsonLd(opts: {
  siteUrl: string;
  totalCents: number;
  talerCount: number;
  maxPersons: number;
  seasonEnd: string;
}) {
  const site = opts.siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Weihnachtsmarkt-Lounge der Händler',
    description: `Überdachte Lounge auf dem Weihnachtsmarkt im Schlosspark Detmold: 2 Stunden exklusiv, bis zu ${opts.maxPersons} Personen, ${opts.talerCount} € Freiverzehr in Residenztalern und Tischservice.`,
    image: `${site}/og-image.png`,
    brand: { '@type': 'Brand', name: 'Die Händler – Werbegemeinschaft Detmold' },
    offers: {
      '@type': 'Offer',
      url: `${site}/#buchen`,
      price: (opts.totalCents / 100).toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      priceValidUntil: opts.seasonEnd,
      seller: { '@type': 'Organization', name: LEGAL_SHORT.company },
    },
  };
}
