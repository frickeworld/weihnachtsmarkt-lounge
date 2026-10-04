import { Link, NavLink, Outlet } from 'react-router-dom';
import { HaendlerLogo } from '@/components/HaendlerLogo';
import { useNoindex } from '@/lib/useNoindex';
import { useAuth } from '../AuthProvider';

const NAV = [
  { to: '/admin', label: 'Übersicht', end: true },
  { to: '/admin/buchungen', label: 'Buchungen' },
  { to: '/admin/neue-buchung', label: 'Neue Buchung' },
  { to: '/admin/kalender', label: 'Kalender' },
  { to: '/admin/einstellungen', label: 'Einstellungen' },
  { to: '/admin/zugaenge', label: 'Zugänge' },
  { to: '/admin/export', label: 'Export' },
  { to: '/admin/datenpflege', label: 'Datenpflege' },
];

export function AdminLayout() {
  useNoindex();
  const { session, signOut } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="on-dark bg-brown print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/admin" className="flex items-center gap-3" aria-label="Admin-Übersicht">
            <HaendlerLogo />
            <span className="rounded-full border border-gold-light/50 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-gold-light">
              ADMIN
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-on-dark">
            <span className="hidden sm:inline">{session?.user.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="min-h-11 rounded-full border border-on-dark/40 px-4 font-semibold hover:bg-on-dark hover:text-brown"
            >
              Abmelden
            </button>
          </div>
        </div>
        <nav aria-label="Admin-Navigation" className="border-t border-white/10">
          <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2">
            {NAV.map((n) => (
              <li key={n.to} className="shrink-0">
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-gold text-gold-light'
                        : 'border-transparent text-on-dark/80 hover:text-on-dark'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
