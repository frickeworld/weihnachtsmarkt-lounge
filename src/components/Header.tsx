import { HaendlerLogo } from './HaendlerLogo';
import { trackBookClick } from '@/lib/track';

const nav = [
  { href: '#erlebnis', label: 'Erlebnis' },
  { href: '#preis', label: 'Preis' },
  { href: '#ablauf', label: 'Ablauf' },
  { href: '#faq', label: 'FAQ' },
  { href: '#kontakt', label: 'Kontakt' },
  { href: '#anfahrt', label: 'Anfahrt' },
];

export function Header({ home = true }: { home?: boolean }) {
  const prefix = home ? '' : '/';
  return (
    <header className="on-dark sticky top-0 z-40 bg-brown/95 text-on-dark backdrop-blur-md">
      {/* Mobil: nur das Logo, zentriert. „Lounge buchen“ steht mobil unten in der festen Leiste. */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-center gap-4 px-4 sm:px-6 md:justify-between">
        <a href={`${prefix}#start`} aria-label="Zur Startseite" className="shrink-0">
          <HaendlerLogo size="sm" />
        </a>
        <nav aria-label="Abschnitte" className="hidden lg:block">
          <ul className="flex gap-7 text-sm text-on-dark/85">
            {nav.map((n) => (
              <li key={n.href}>
                <a href={`${prefix}${n.href}`} className="transition-colors hover:text-gold-light">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={`${prefix}#buchen`}
          onClick={trackBookClick}
          className="btn-gold !hidden !min-h-10 !px-5 !py-2 text-sm md:!inline-flex"
        >
          Lounge buchen
        </a>
      </div>
    </header>
  );
}
