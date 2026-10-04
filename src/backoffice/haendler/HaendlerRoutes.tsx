import { Link } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthProvider';
import { AuthShell } from '../auth/AuthShell';
import { RequireAccess } from '../RequireAccess';
import { smallBtn } from '../ui';

/** /haendler – Dashboard und Abrechnung folgen in Phase 7. */
export default function HaendlerRoutes() {
  return (
    <AuthProvider>
      <RequireAccess area="haendler">
        <HaendlerPlaceholder />
      </RequireAccess>
    </AuthProvider>
  );
}

function HaendlerPlaceholder() {
  const { session, aal, signOut } = useAuth();
  return (
    <AuthShell title="Händler-Bereich">
      <div className="space-y-5">
        <p className="text-ink-soft">
          Hallo {session?.user.email}. Hier siehst du bald Buchungen, Kennzahlen und die Abrechnung
          der Lounge.
        </p>
        {aal.next !== 'aal2' && (
          <Link to="/login/2fa?einrichten=1&next=%2Fhaendler" className="btn-outline w-full">
            Zwei-Faktor-Anmeldung einrichten (empfohlen)
          </Link>
        )}
        <button type="button" className={`${smallBtn} w-full`} onClick={() => void signOut()}>
          Abmelden
        </button>
      </div>
    </AuthShell>
  );
}
