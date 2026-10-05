/** Adventskranz mit vier Kerzen, `lit` davon brennen (Flamme flackert, außer bei „Bewegung reduzieren“). */
export function AdventCandles({ lit, className = '' }: { lit: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 28"
      className={className}
      role="img"
      aria-label={`${lit} von 4 Adventskerzen brennen`}
    >
      {[0, 1, 2, 3].map((i) => {
        const x = 8 + i * 16;
        const on = i < lit;
        return (
          <g key={i}>
            {on && (
              <path
                className="candle-flame"
                style={{ animationDelay: `${i * 0.37}s`, transformOrigin: `${x}px 11px` }}
                d={`M${x} 3c2 3 2.6 5 0 8c-2.6-3-2-5 0-8z`}
                fill="#F6D27A"
              />
            )}
            <rect
              x={x - 3}
              y="11"
              width="6"
              height="12"
              rx="1.2"
              fill={on ? '#E8D6A8' : '#9C8F78'}
            />
          </g>
        );
      })}
      <path
        d="M2 24c10 4 50 4 60 0"
        stroke="#3F6B4E"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
