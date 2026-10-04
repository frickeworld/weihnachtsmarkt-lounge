import { Link } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { PageHeader, Panel, smallBtn } from '../ui';

export function HaendlerAccount() {
  const { session, aal, signOut } = useAuth();
  return (
    <>
      <PageHeader title="Konto" />
      <div className="grid max-w-3xl gap-6">
        <Panel title="Anmeldung">
          <p className="text-ink-soft">
            Angemeldet als <strong className="text-ink">{session?.user.email}</strong>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/login/passwort-vergessen" className={smallBtn}>
              Passwort ändern
            </Link>
            <button type="button" className={smallBtn} onClick={() => void signOut()}>
              Abmelden
            </button>
          </div>
        </Panel>
        <Panel title="Zwei-Faktor-Anmeldung">
          {aal.next === 'aal2' ? (
            <p className="text-emerald-800">
              ✓ Eingerichtet. Bei jeder Anmeldung fragen wir den Code aus deiner App ab.
            </p>
          ) : (
            <>
              <p className="text-ink-soft">
                Freiwillig, aber empfohlen: Neben dem Passwort brauchst du dann einen Code aus einer
                Authenticator-App.
              </p>
              <Link
                to="/login/2fa?einrichten=1&next=%2Fhaendler%2Fkonto"
                className="btn-outline mt-4"
              >
                Jetzt einrichten
              </Link>
            </>
          )}
        </Panel>
        <Panel title="Datenschutz">
          <p className="text-sm text-ink-soft">
            Im Händler-Bereich siehst du keine E-Mail-Adressen, Telefonnummern, Rechnungsadressen
            oder Wünsche der Gäste. Bei Fragen zu einer Buchung hilft Studio F.
          </p>
        </Panel>
      </div>
    </>
  );
}
