import { useEffect, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const menu = [
    { href: `${prefix}#besondere-abende`, label: 'Partys und besondere Abende' },
    ...nav.map((n) => ({ href: `${prefix}${n.href}`, label: n.label })),
  ];
  return (
    <header className="on-dark sticky top-0 z-40 bg-brown/95 text-on-dark backdrop-blur-md">
      {showGiveaway && <GiveawayTicker />}
      {/* Mobil: Logo zentriert, rechts das Geschenk „Lounge gewinnen“. „Lounge buchen“ steht mobil
          unten in der festen Leiste. */}
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-center gap-4 px-4 sm:px-6 md:justify-between">
        {/* Burger-Menü bis zur Desktop-Breite */}
        <button
          type="button"
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={open}
          aria-controls="hauptmenue"
          onClick={() => setOpen((o) => !o)}
          className="absolute left-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-on-dark transition-colors hover:bg-white/10 md:static lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
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
      {open && (
        <nav
          id="hauptmenue"
          aria-label="Menü"
          className="border-t border-white/10 bg-brown lg:hidden"
        >
          <ul className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            {menu.map((m) => (
              <li key={m.href}>
                <a
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center border-b border-white/10 text-lg text-on-dark/90 hover:text-gold-light"
                >
                  {m.label}
                </a>
              </li>
            ))}
            {showGiveaway && (
              <li>
                <Link
                  to="/gewinnspiel"
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center gap-2 border-b border-white/10 text-lg font-semibold text-gold-light"
                >
                  <GiftIcon className="h-5 w-5" />
                  Lounge gewinnen
                </Link>
              </li>
            )}
            <li className="pt-4 pb-2">
              <a
                href={`${prefix}#buchen`}
                onClick={() => {
                  trackBookClick();
                  setOpen(false);
                }}
                className="btn-gold w-full justify-center"
              >
                Lounge buchen
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
