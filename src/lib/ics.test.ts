import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl } from '../../supabase/functions/_shared/ics';

const base = {
  uid: 'b1@lounge',
  date: '2026-12-05',
  startTime: '17:45',
  endTime: '19:45',
  persons: 8,
  talerCount: 100,
  bookingCode: 'HL-ABCD-EFGH',
  location: 'Weihnachtsmarkt im Schlosspark, Detmold',
  ticketUrl: 'https://example.de/ticket/Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z',
  now: new Date('2026-10-05T08:00:00Z'),
};

describe('buildIcs', () => {
  it('rechnet Berliner Winterzeit in UTC um und setzt eine Erinnerung', () => {
    const ics = buildIcs(base);
    expect(ics).toContain('DTSTART:20261205T164500Z');
    expect(ics).toContain('DTEND:20261205T184500Z');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('LOCATION:Weihnachtsmarkt im Schlosspark\\, Detmold');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('faltet lange Zeilen auf höchstens 75 Byte', () => {
    for (const line of buildIcs(base).split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('googleCalendarUrl', () => {
  it('Termin in UTC mit Ort und Buchungscode', () => {
    const url = new URL(googleCalendarUrl(base));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261205T164500Z/20261205T184500Z');
    expect(url.searchParams.get('location')).toBe('Weihnachtsmarkt im Schlosspark, Detmold');
    expect(url.searchParams.get('details')).toContain('HL-ABCD-EFGH');
  });
});
