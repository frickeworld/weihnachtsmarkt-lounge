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

const berlinParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Abstand Europe/Berlin zu UTC in Minuten zum Zeitpunkt `ms`. */
function berlinOffsetMinutes(ms: number): number {
  const parts = berlinParts.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((wall - ms) / 60000);
}

/** Kalendertag + Uhrzeit in Berlin → ISO 8601 mit Offset, z. B. '2026-12-05T17:30:00+01:00'. */
export function berlinIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let offset = berlinOffsetMinutes(wall);
  offset = berlinOffsetMinutes(wall - offset * 60000);
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${date}T${hhmm(time)}:00${off}`;
}
