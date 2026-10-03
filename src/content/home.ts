/**
 * Texte des One-Pagers. Preise, Taler und Personenzahl werden aus den Einstellungen eingesetzt,
 * damit sie nie hart im Text stehen.
 */
export const PLACEHOLDER_POSITION = '[GENAUE POSITION]';

export const MAPS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=' +
  encodeURIComponent('Schloßplatz 1, 32756 Detmold');

export const howItWorks = [
  { title: 'Termin wählen', text: 'Tag und Zeitfenster aussuchen.' },
  { title: 'Sicher bezahlen', text: 'Bequem online über Stripe.' },
  { title: 'Ticket erhalten', text: 'Dein Ticket mit QR-Code kommt sofort per E-Mail.' },
  { title: 'Genießen', text: 'QR-Code am Einlass zeigen, Residenztaler erhalten, Platz nehmen.' },
] as const;

export const occasions = [
  {
    key: 'firma',
    title: 'Firmenfeier',
    text: 'Die Weihnachtsfeier, über die dein Team noch lange spricht. Ohne Saalmiete, ohne Planungsstress.',
  },
  {
    key: 'familie',
    title: 'Familienfeier',
    text: 'Großeltern, Eltern, Kinder: alle an einem Tisch, mitten im Weihnachtszauber.',
  },
  {
    key: 'freunde',
    title: 'Freunde',
    text: 'Der Abend, an dem ihr euch endlich wieder alle seht.',
  },
] as const;
