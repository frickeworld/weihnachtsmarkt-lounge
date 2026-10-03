import { Link } from 'react-router-dom';
import { LogoPlaque } from './LogoPlaque';
import { LightString } from './LightString';
import { StudioFBadge } from './StudioFBadge';

export function Footer() {
  return (
    <footer className="relative mt-10 border-t border-gold/15 bg-coal/60 pb-28 md:pb-10">
      <LightString variant="divider" className="-mt-px opacity-80" />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-6 text-center sm:px-6">
        <LogoPlaque size="md" />
        <p className="text-sm text-cream/75">
          Eine Aktion der Händler – Werbegemeinschaft Detmold e. V.
        </p>
        <nav aria-label="Rechtliches">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-cream/75">
            <li>
              <Link to="/impressum" className="hover:text-champagne">
                Impressum
              </Link>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link to="/datenschutz" className="hover:text-champagne">
                Datenschutz
              </Link>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link to="/agb" className="hover:text-champagne">
                AGB
              </Link>
            </li>
          </ul>
        </nav>
        <div className="mt-4">
          <StudioFBadge />
        </div>
      </div>
    </footer>
  );
}
