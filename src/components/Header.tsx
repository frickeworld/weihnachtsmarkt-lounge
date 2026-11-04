import { Link } from 'react-router-dom';
import { useGiveawayInfo } from '@/lib/useGiveawayInfo';
import { GiftIcon, GiveawayTicker } from './GiveawayTicker';
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

export function Header({ home = true, giveaway = true }: { home?: boolean; giveaway?: boolean }) {
  const prefix = home ? '' : '/';
  const info = useGiveawayInfo();
  const showGiveaway = giveaway && Boolean(info?.active);
  return (
    <header className="on-dark sticky top-0 z-40 bg-brown/95 text-on-dark backdrop-blur-md">
      {showGiveaway && <GiveawayTicker />}
      {/* Mobil: Logo zentriert, rechts das Geschenk „Lounge gewinnen“. „Lounge buchen“ steht mobil
          unten in der festen Leiste. */}
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-center gap-4 px-4 sm:px-6 md:justify-between">
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
        <div className="contents md:flex md:items-center md:gap-3">
          {showGiveaway && (
            <Link
              to="/gewinnspiel"
              aria-label="Lounge gewinnen"
              className="absolute right-3 inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-gold-light/50 px-3 text-sm font-semibold text-gold-light transition-colors hover:bg-gold-light/10 md:static"
            >
              <GiftIcon className="gift-wiggle h-5 w-5" />
              <span className="hidden md:inline">Lounge gewinnen</span>
            </Link>
          )}
          <a
            href={`${prefix}#buchen`}
            onClick={trackBookClick}
            className="btn-gold !hidden !min-h-10 !px-5 !py-2 text-sm md:!inline-flex"
          >
            Lounge buchen
          </a>
        </div>
      </div>
    </header>
  );
}
