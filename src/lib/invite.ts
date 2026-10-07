import { formatLongDate } from './dates';

/**
 * Einladungstext für die eigene Runde. Verlinkt die Website, nicht das Ticket – der QR-Code
 * bleibt beim Bucher.
 */
export function inviteText(date: string, startTime: string, endTime: string, siteUrl: string) {
  return [
    `Ich habe die Lounge auf dem Weihnachtsmarkt im Schlosspark Detmold gebucht – kommst du mit?`,
    `${formatLongDate(date)}, ${startTime}–${endTime} Uhr`,
    `Freiverzehr und Tischservice inklusive. Mehr dazu: ${siteUrl.replace(/\/$/, '')}/`,
  ].join('\n');
}

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
