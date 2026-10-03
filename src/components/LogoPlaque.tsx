import haendlerLogo from '@/assets/haendler-logo.png';

type Size = 'sm' | 'lg';

const sizes: Record<Size, string> = {
  sm: 'px-3 py-2 [&_img]:h-6',
  lg: 'px-6 py-5 sm:px-9 sm:py-7 [&_img]:h-12 sm:[&_img]:h-16',
};

/**
 * Händler-Logo unverändert in Originalfarben auf Creme-Plakette mit Goldrand.
 * Die dunkelgraue Unterzeile wäre direkt auf Nachtschwarz nicht lesbar.
 */
export function LogoPlaque({ size = 'sm', className = '' }: { size?: Size; className?: string }) {
  return (
    <div
      className={`inline-flex items-center rounded-sm bg-cream ring-1 ring-gold/70 shadow-[0_0_0_4px_rgba(201,162,77,0.12)] ${sizes[size]} ${className}`}
    >
      <img
        src={haendlerLogo}
        alt="Die Händler – Wir handeln für Detmold."
        className="w-auto"
        decoding="async"
      />
    </div>
  );
}
