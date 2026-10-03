// Datums- und Zeitformatierung für Stripe-Positionen und E-Mails (deutsch).

const longDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** '2026-12-05' → 'Samstag, 5. Dezember 2026' */
export function formatLongDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`));
}

/** '17:30:00' → '17:30' */
export function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function slotLabel(start: string, end: string): string {
  return `${hhmm(start)}–${hhmm(end)} Uhr`;
}
