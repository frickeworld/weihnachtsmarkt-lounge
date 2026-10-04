import logo from '@/assets/weihnachtsmarkt-logo.svg';

/** Schriftzug „Weihnachtsmarkt im Schlosspark Detmold“ (von weihnachtsmarkt-detmold.de, Platzhalter). */
export function WeihnachtsmarktLogo({
  tone = 'dark',
  className = '',
}: {
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <img
      src={logo}
      alt="Weihnachtsmarkt im Schlosspark Detmold"
      width={274}
      height={71}
      decoding="async"
      className={`h-auto ${tone === 'light' ? 'invert' : ''} ${className}`}
    />
  );
}
