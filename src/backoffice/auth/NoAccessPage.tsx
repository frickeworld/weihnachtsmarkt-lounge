import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { homeFor } from '../roles';
import { AuthShell } from './AuthShell';

export function NoAccessPage() {
  const { session, roles, signOut } = useAuth();
  const home = homeFor(roles);
  return (
    <AuthShell title="Kein Zugang">
      <div className="space-y-5">
        <p className="text-ink-soft">
          {session
            ? `Du bist als ${session.user.email} angemeldet, hast für diesen Bereich aber keine Berechtigung.`
            : 'Für diesen Bereich brauchst du eine Anmeldung.'}{' '}
          Zugänge vergibt Studio F per Einladung.
        </p>
        {session && home !== '/login/kein-zugang' && (
          <Link to={home} className="btn-gold w-full">
            Zu meinem Bereich
          </Link>
        )}
        {session ? (
          <button type="button" className="btn-outline w-full" onClick={() => void signOut()}>
            Abmelden
          </button>
        ) : (
          <Link to="/login" className="btn-gold w-full">
            Zur Anmeldung
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
