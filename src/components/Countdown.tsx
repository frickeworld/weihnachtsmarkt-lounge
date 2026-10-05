import { useEffect, useState } from 'react';
import { countdown } from '@/lib/countdown';

/** „Noch 12 Tage 4 Std.“ bzw. unter einem Tag „03 : 12 : 45“ bis zum Beginn der Lounge. */
export function Countdown({
  date,
  startTime,
  endTime,
}: {
  date: string;
  startTime: string;
  endTime: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const c = countdown(date, startTime, endTime, now);
  if (c.phase === 'over') return null;

  const box = (value: number | string, label: string) => (
    <div className="flex min-w-16 flex-col items-center rounded-2xl bg-surface px-3 py-2 ring-1 ring-line">
      <span className="font-display text-3xl leading-none font-medium tabular-nums">{value}</span>
      <span className="mt-1 text-xs text-ink-soft">{label}</span>
    </div>
  );
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="mt-6 w-full" role="timer" aria-live="off">
      {c.phase === 'running' ? (
        <p className="glitter rounded-2xl px-5 py-3 text-center font-semibold">
          Deine Lounge läuft gerade – viel Freude!
        </p>
      ) : (
        <>
          <p className="eyebrow mb-3 text-center">Noch bis zu deiner Lounge</p>
          <div className="flex justify-center gap-2">
            {c.days > 0 ? (
              <>
                {box(c.days, c.days === 1 ? 'Tag' : 'Tage')}
                {box(c.hours, 'Std.')}
                {box(pad(c.minutes), 'Min.')}
              </>
            ) : (
              <>
                {box(pad(c.hours), 'Std.')}
                {box(pad(c.minutes), 'Min.')}
                {box(pad(c.seconds), 'Sek.')}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
