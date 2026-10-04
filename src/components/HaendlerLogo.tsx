import logo480 from '@/assets/haendler-logo-weiss-480.webp';
import logo960 from '@/assets/haendler-logo-weiss-960.webp';

type Size = 'sm' | 'md' | 'lg';

const sizes: Record<Size, { img: string; width: number }> = {
  sm: { img: 'h-8 md:h-7', width: 190 },
  md: { img: 'h-9', width: 220 },
  lg: { img: 'h-12 sm:h-16', width: 420 },
};

/**
 * Händler-Logo komplett weiß (Entscheidung Design-Runde 1). Nur auf dunklen Flächen verwenden –
 * auf hellem Grund mit `plate` (dunkelbraune Unterlage).
 */
export function HaendlerLogo({
  size = 'sm',
  plate = false,
  className = '',
}: {
  size?: Size;
  plate?: boolean;
  className?: string;
}) {
  const s = sizes[size];
  const img = (
    <img
      src={logo480}
      srcSet={`${logo480} 480w, ${logo960} 960w`}
      sizes={`${s.width}px`}
      alt="Die Händler – Wir handeln für Detmold."
      className={`w-auto ${s.img}`}
      width={2261}
      height={377}
      decoding="async"
    />
  );
  if (!plate) return <span className={`inline-flex ${className}`}>{img}</span>;
  return <span className={`inline-flex rounded-xl bg-brown px-4 py-3 ${className}`}>{img}</span>;
}
