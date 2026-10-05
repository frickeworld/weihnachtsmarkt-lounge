// Kalendereintrag (iCalendar, RFC 5545) für eine Buchung – Zeiten in UTC, Erinnerung 2 h vorher.
import { berlinIso } from './format.ts';

export interface IcsInput {
  uid: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  persons: number;
  talerCount: number;
  bookingCode: string;
  location: string;
  ticketUrl: string;
  now?: Date;
}

const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Sonderzeichen nach RFC 5545 maskieren. */
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

/** Zeilen länger als 75 Byte falten (Folgezeilen beginnen mit einem Leerzeichen). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(i: IcsInput): string {
  const start = new Date(berlinIso(i.date, i.startTime));
  const end = new Date(berlinIso(i.date, i.endTime));
  const description = [
    `Deine Lounge für bis zu ${i.persons} Personen, inkl. ${i.talerCount} € Freiverzehr in Residenztalern.`,
    `Buchungscode: ${i.bookingCode}`,
    `Ticket: ${i.ticketUrl}`,
  ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Die Haendler Detmold//Weihnachtsmarkt-Lounge//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${i.uid}`,
    `DTSTAMP:${utc(i.now ?? new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${esc('Weihnachtsmarkt-Lounge der Händler')}`,
    `LOCATION:${esc(i.location)}`,
    `DESCRIPTION:${esc(description)}`,
    `URL:${i.ticketUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Gleich geht es in die Lounge – Ticket bereithalten.')}`,
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
