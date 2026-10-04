import { useEffect } from 'react';
import { env } from '@/lib/env';
import { totalCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { buildProductJsonLd } from '@/lib/structuredData';

export function StructuredData() {
  const s = useSettings();
  const json = JSON.stringify(
    buildProductJsonLd({
      siteUrl: env.publicSiteUrl,
      totalCents: totalCents(s),
      talerCount: s.talerCount,
      maxPersons: s.maxPersons,
      seasonEnd: s.seasonEnd,
    }),
  );
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = json;
    document.head.appendChild(el);
    return () => el.remove();
  }, [json]);
  return null;
}
