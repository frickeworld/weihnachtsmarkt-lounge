import logo480 from '@/assets/haendler-logo-480.webp';
import logo960 from '@/assets/haendler-logo-960.webp';

type Size = 'sm' | 'md' | 'lg';

const sizes: Record<Size, { box: string; img: string; width: number }> = {
  sm: { box: 'px-2.5 py-1.5', img: 'h-5 sm:h-6', width: 160 },
  md: { box: 'px-4 py-3', img: 'h-8', width: 200 },
  lg: { box: 'px-6 py-5 sm:px-10 sm:py-7', img: 'h-11 sm:h-16', width: 420 },
};

/**
 * Händler-Logo unverändert in Originalfarben auf Creme-Plakette mit Goldrand.
 * Die dunkelgraue Unterzeile wäre direkt auf Nachtschwarz nicht lesbar.
 */
export function LogoPlaque({ size = 'sm', className = '' }: { size?: Size; className?: string }) {
  const s = sizes[size];
  return (
    <div
      className={`inline-flex items-center rounded-[2px] bg-cream shadow-[0_0_0_1px_rgba(201,162,77,0.8),0_0_0_5px_rgba(201,162,77,0.12)] ${s.box} ${className}`}
    >
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
    </div>
  );
}
