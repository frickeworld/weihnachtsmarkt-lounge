import { useEffect, useState } from 'react';

// Countdown bis zur nächsten Gewinnspiel-Ziehung (sonntags 18:00 Uhr Berlin).

/** Restzeit bis `target` in Tagen, Stunden, Minuten, Sekunden (nie negativ). */
export function remaining(target: string, now = Date.now()) {
  const ms = Math.max(new Date(target).getTime() - now, 0);
  const s = Math.floor(ms / 1000);
  return {
    done: ms === 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** Tickt einmal pro Sekunde. */
export function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [target]);
  return target ? remaining(target, now) : null;
}

/** „Sonntag, 6. Dezember, 18:00 Uhr“ */
export function formatDrawTime(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  const time = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${day}, ${time} Uhr`;
}

export const pad = (n: number) => String(n).padStart(2, '0');

/** Kurzform für Leisten: „3 T 04:12:09“ */
export function shortCountdown(r: NonNullable<ReturnType<typeof remaining>>): string {
  return `${r.days > 0 ? `${r.days} T ` : ''}${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`;
}
