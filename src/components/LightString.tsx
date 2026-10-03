import { useLayoutEffect, useRef, useState } from 'react';

type Variant = 'hero' | 'divider';

const config: Record<
  Variant,
  { height: number; sag: number; swagWidth: number; spacing: number; r: number }
> = {
  hero: { height: 90, sag: 46, swagWidth: 520, spacing: 46, r: 5 },
  divider: { height: 40, sag: 16, swagWidth: 360, spacing: 40, r: 3.2 },
};

/** Deterministischer Zufall, damit das Funkeln bei jedem Render gleich verteilt ist. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Durchhängende Lichterkette als SVG. Lämpchen in Warmweiß und Gold, jedes funkelt mit eigener Verzögerung.
 * Funkeln ist bei „Bewegung reduzieren“ per CSS aus.
 */
export function LightString({
  variant = 'hero',
  className = '',
}: {
  variant?: Variant;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const c = config[variant];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const swags = Math.max(1, Math.round(width / c.swagWidth));
  const swagW = width / swags;
  const top = 6;
  // Kabel als quadratische Bögen; Lämpchen werden auf derselben Kurve verteilt.
  const yAt = (x: number) => {
    const t = (x % swagW) / swagW;
    return top + c.sag * 4 * t * (1 - t);
  };
  const path = Array.from({ length: swags }, (_, i) => {
    const x0 = i * swagW;
    return `${i === 0 ? `M${x0} ${top}` : ''} Q${x0 + swagW / 2} ${top + c.sag * 2} ${x0 + swagW} ${top}`;
  }).join(' ');

  const bulbs: { x: number; y: number; i: number }[] = [];
  if (width > 0) {
    const perSwag = Math.max(3, Math.round(swagW / c.spacing));
    for (let s = 0; s < swags; s++) {
      for (let k = 1; k < perSwag; k++) {
        const x = s * swagW + (k * swagW) / perSwag;
        bulbs.push({ x, y: yAt(x), i: bulbs.length });
      }
    }
  }

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none w-full ${className}`}
      style={{ height: c.height }}
    >
      {width > 0 && (
        <svg
          width={width}
          height={c.height}
          viewBox={`0 0 ${width} ${c.height}`}
          className="block overflow-visible"
        >
          <defs>
            <radialGradient id={`bulb-warm-${variant}`}>
              <stop offset="0" stopColor="#fffbe9" />
              <stop offset="0.45" stopColor="#ffe3a3" />
              <stop offset="1" stopColor="#ffcf73" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`bulb-gold-${variant}`}>
              <stop offset="0" stopColor="#fff2cf" />
              <stop offset="0.45" stopColor="#e9c46f" />
              <stop offset="1" stopColor="#c9a24d" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={path} fill="none" stroke="#2c241c" strokeWidth={variant === 'hero' ? 2 : 1.4} />
          {bulbs.map(({ x, y, i }) => {
            const gold = rand(i) > 0.62;
            return (
              <g key={i}>
                <rect
                  x={x - c.r * 0.45}
                  y={y}
                  width={c.r * 0.9}
                  height={c.r * 0.9}
                  fill="#2c241c"
                />
                <circle
                  className="bulb"
                  cx={x}
                  cy={y + c.r * 2.1}
                  r={c.r * 3.2}
                  fill={`url(#bulb-${gold ? 'gold' : 'warm'}-${variant})`}
                  style={
                    {
                      '--twinkle-delay': `${(rand(i + 7) * 5).toFixed(2)}s`,
                      '--twinkle-duration': `${(2.4 + rand(i + 13) * 2.6).toFixed(2)}s`,
                    } as React.CSSProperties
                  }
                />
                <circle
                  cx={x}
                  cy={y + c.r * 2.1}
                  r={c.r * 0.75}
                  fill={gold ? '#fff2cf' : '#fffbe9'}
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
