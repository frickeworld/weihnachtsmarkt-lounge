import { pad, useCountdown } from '@/lib/drawCountdown';

/** Große Kacheln: Tage · Std. · Min. · Sek. */
export function GiveawayCountdown({
  target,
  tone = 'light',
}: {
  target: string;
  tone?: 'light' | 'dark';
}) {
  const r = useCountdown(target);
  if (!r) return null;
  if (r.done) return <p className="font-semibold">Die Ziehung läuft gerade – viel Glück!</p>;
  const parts: [number, string][] = [
    [r.days, r.days === 1 ? 'Tag' : 'Tage'],
    [r.hours, 'Std.'],
    [r.minutes, 'Min.'],
    [r.seconds, 'Sek.'],
  ];
  const tile =
    tone === 'dark'
      ? 'bg-brown text-on-dark'
      : 'bg-surface/90 text-ink shadow-[0_8px_20px_-14px_rgba(19,37,28,0.7)]';
  return (
    <div>
      <ol
        className="flex gap-2 sm:gap-3"
        aria-label={`Noch ${r.days} Tage, ${r.hours} Stunden, ${r.minutes} Minuten bis zur Ziehung`}
      >
        {parts.map(([n, label]) => (
          <li
            key={label}
            className={`flex min-w-[3.6rem] flex-col items-center rounded-2xl px-2 py-2 sm:min-w-[4.4rem] ${tile}`}
            aria-hidden="true"
          >
            <span className="font-display text-2xl leading-none font-medium tabular-nums sm:text-3xl">
              {label === 'Tag' || label === 'Tage' ? n : pad(n)}
            </span>
            <span className="mt-1 text-[0.7rem] font-semibold tracking-wide uppercase">
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
