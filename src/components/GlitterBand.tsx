import type { ReactNode } from 'react';

const STARS = [
  { left: '7%', top: '30%', size: 14, delay: '0s' },
  { left: '18%', top: '62%', size: 10, delay: '1.2s' },
  { left: '82%', top: '28%', size: 16, delay: '0.6s' },
  { left: '92%', top: '64%', size: 11, delay: '2s' },
  { left: '70%', top: '70%', size: 9, delay: '2.6s' },
];

/**
 * Gold-Glitzer-Band wie auf weihnachtsmarkt-detmold.de, optional mit Inhalt (z. B. Logo-Schriftzug).
 * `soft` legt einen hellen Schleier darüber, damit längere Texte gut lesbar bleiben.
 */
export function GlitterBand({
  children,
  className = '',
  stars = true,
  soft = false,
}: {
  children?: ReactNode;
  className?: string;
  stars?: boolean;
  soft?: boolean;
}) {
  return (
    <div className={`glitter relative overflow-hidden ${className}`}>
      {soft && <div aria-hidden="true" className="absolute inset-0 bg-[#fff8e6]/45" />}
      {stars &&
        STARS.map((s, i) => (
          <svg
            key={i}
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="sparkle absolute fill-white/90"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
            }}
          >
            <path d="M12 0l2.6 8.2L23 9l-6.8 5.1L18.5 23 12 18l-6.5 5 2.3-8.9L1 9l8.4-.8z" />
          </svg>
        ))}
      <div className="relative">{children}</div>
    </div>
  );
}
