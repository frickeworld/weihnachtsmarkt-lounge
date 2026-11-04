import { Link } from 'react-router-dom';
import { formatDrawTime, shortCountdown, useCountdown } from '@/lib/drawCountdown';
import { useGiveawayInfo } from '@/lib/useGiveawayInfo';

/** Geschenk-Symbol für „Lounge gewinnen“. */
export function GiftIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3" y="8" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v13" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8c-1.5-3.5-5.5-4-5.5-1.5S10 8 12 8Zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 8 12 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Laufende Gold-Leiste ganz oben: „Lounge gewinnen“ mit Countdown bis zur Ziehung am Sonntag.
 * Nur sichtbar, solange das Gewinnspiel aktiv ist. Bei reduzierter Bewegung steht der Text still.
 */
export function GiveawayTicker() {
  const info = useGiveawayInfo();
  const target = info?.active ? info.nextDrawAt : null;
  const r = useCountdown(target);
  if (!target || !r || r.done) return null;

  const items = [
    'Jetzt eine Lounge gewinnen',
    `Ziehung ${formatDrawTime(target)}`,
    `Noch ${shortCountdown(r)}`,
    'Kostenlos mitmachen',
  ];
  const run = (copy: number) => (
    <span className="flex shrink-0 items-center" aria-hidden={copy > 0 || undefined}>
      {items.map((t) => (
        <span key={`${copy}-${t}`} className="flex items-center whitespace-nowrap">
          <GiftIcon className="mx-4 h-4 w-4 shrink-0" />
          <span className={t.startsWith('Noch') ? 'tabular-nums' : undefined}>{t}</span>
        </span>
      ))}
    </span>
  );

  return (
    <Link
      to="/gewinnspiel"
      className="ticker glitter block overflow-hidden py-1.5 text-sm font-semibold text-ink"
      aria-label={`Lounge gewinnen: Ziehung ${formatDrawTime(target)}. Jetzt kostenlos mitmachen.`}
    >
      <span className="ticker-track flex w-max">
        {run(0)}
        {run(1)}
      </span>
    </Link>
  );
}
