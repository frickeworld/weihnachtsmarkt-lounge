const time = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});
const day = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
});

export const clock = (iso: string) => time.format(new Date(iso));
export const shortDay = (d: string) => day.format(new Date(`${d}T00:00:00Z`));
