import { useEffect, useRef, useState } from 'react';
import { formatDay } from './format';

interface Point {
  date: string;
  value: number;
}

const H = 160;
const PAD_LEFT = 32;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;

/** Gerundete Achsenschritte (1, 2, 5 × 10ⁿ). */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
  return { top: Math.ceil(max / step) * step, step };
}

/**
 * Säulen pro Tag – eine Reihe, darum ohne Legende (der Titel benennt sie).
 * Hover/Fokus zeigt den Wert, die Tabelle darunter enthält alle Werte.
 */
export function DailyBars({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: Point[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.max(280, Math.round(e!.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const plotW = width - PAD_LEFT;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.min(24, Math.max(2, band - 2)); // 2px Lücke zwischen Säulen
  const { top, step } = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const y = (v: number) => PAD_TOP + (H - PAD_BOTTOM - PAD_TOP) * (1 - v / top);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil((points.length * 44) / plotW) || 1;
  const total = points.reduce((s, p) => s + p.value, 0);
  const h = hover !== null ? points[hover] : null;

  return (
    <figure className="card min-w-0 p-5">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-ink-soft">
          gesamt {total.toLocaleString('de-DE')} {unit}
        </span>
      </figcaption>
      <div className="relative w-full overflow-hidden" ref={box}>
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          className="block"
          role="img"
          aria-label={`${title}, ${points.length} Tage, gesamt ${total} ${unit}`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={width}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={PAD_LEFT - 6}
                y={y(t) + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-ink-soft)"
              >
                {t.toLocaleString('de-DE')}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = PAD_LEFT + i * band + (band - barW) / 2;
            const bh = H - PAD_BOTTOM - y(p.value);
            const r = Math.min(4, barW / 2, bh);
            const yTop = y(p.value);
            const base = H - PAD_BOTTOM;
            return (
              <g key={p.date}>
                {p.value > 0 && (
                  <path
                    d={`M${x},${base} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${base} Z`}
                    fill="var(--color-chart)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text
                    x={x + barW / 2}
                    y={H - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--color-ink-soft)"
                  >
                    {p.date.slice(8, 10)}.{p.date.slice(5, 7)}.
                  </text>
                )}
                {/* Trefferfläche über die ganze Spalte */}
                <rect
                  x={PAD_LEFT + i * band}
                  y={0}
                  width={band}
                  height={base}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}
          <line
            x1={PAD_LEFT}
            x2={width}
            y1={H - PAD_BOTTOM}
            y2={H - PAD_BOTTOM}
            stroke="var(--color-ink-soft)"
            strokeWidth="1"
          />
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg"
            style={{
              left: `${((PAD_LEFT + hover * band + band / 2) / width) * 100}%`,
              transform: `translateX(${hover > points.length / 2 ? '-100%' : '0'})`,
            }}
          >
            <div className="text-ink-soft">{formatDay(h.date)}</div>
            <div className="font-semibold">
              {h.value.toLocaleString('de-DE')} {unit}
            </div>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-gold-deep">
          Als Tabelle anzeigen
        </summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="py-1 font-semibold">Tag</th>
                <th className="py-1 text-right font-semibold">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="py-1">{formatDay(p.date)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {p.value.toLocaleString('de-DE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
