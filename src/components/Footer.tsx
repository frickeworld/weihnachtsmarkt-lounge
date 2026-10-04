import { Link } from 'react-router-dom';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, MARKET_URL, sponsors } from '@/content/partners';
import { GlitterBand } from './GlitterBand';
import { HaendlerLogo } from './HaendlerLogo';
import { StudioFBadge } from './StudioFBadge';

export function Footer() {
  return (
    <footer className="on-dark bg-brown pb-28 text-on-dark md:pb-10">
      <GlitterBand className="h-2" />
      <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
        <section aria-labelledby="partner-title" className="text-center">
          <h2 id="partner-title" className="text-2xl font-medium">
            Sponsoren &amp; Partner
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-on-dark/70">
            Danke an alle, die den Weihnachtsmarkt im Schlosspark Detmold möglich machen.
          </p>
          <ul className="mt-8 grid grid-cols-2 items-center gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {sponsors.map((s) => (
              <li key={s.name} className="flex justify-center">
                <img
                  src={s.src}
                  alt={s.name}
                  loading="lazy"
                  decoding="async"
                  className="max-h-9 w-auto max-w-[150px] opacity-80 transition-opacity hover:opacity-100"
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="my-12 h-px bg-on-dark/15" aria-hidden="true" />

        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-3 md:items-start">
            <HaendlerLogo size="md" />
            <p className="text-sm text-on-dark/75">
              Eine Aktion der Händler – Werbegemeinschaft Detmold e. V.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 md:items-end">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold hover:text-gold-light"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-none stroke-current"
                strokeWidth={1.6}
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.8" className="fill-current" />
              </svg>
              {INSTAGRAM_HANDLE}
            </a>
            <a
              href={MARKET_URL}
              target="_blank"
              rel="noopener"
              className="text-sm hover:text-gold-light"
            >
              weihnachtsmarkt-detmold.de
            </a>
          </div>
        </div>

        <nav aria-label="Rechtliches" className="mt-10">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-on-dark/75">
            <li>
              <a href="/#kontakt" className="hover:text-gold-light">
                Kontakt
              </a>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link to="/impressum" className="hover:text-gold-light">
                Impressum
              </Link>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link to="/datenschutz" className="hover:text-gold-light">
                Datenschutz
              </Link>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link to="/agb" className="hover:text-gold-light">
                AGB
              </Link>
            </li>
          </ul>
        </nav>
        <div className="mt-10 flex justify-center border-t border-white/10 pt-10">
          <StudioFBadge />
        </div>
      </div>
    </footer>
  );
}
