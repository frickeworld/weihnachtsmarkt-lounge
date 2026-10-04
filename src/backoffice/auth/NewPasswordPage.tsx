import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { authClient } from '../authClient';
import { ErrorBox, Loading } from '../ui';
import { AuthShell } from './AuthShell';
import { passwordProblem } from './passwordRules';

/**
 * Ziel der Einladungs- und Zurücksetzen-Links. supabase-js liest das Token aus dem URL-Hash
 * und meldet die Person an; hier legt sie dann ihr Passwort fest.
 */
export function NewPasswordPage() {
  const { loading, session, refresh } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_description');

  if (loading) return <Loading full />;
  if (!session) {
    return (
      <AuthShell title="Link ungültig">
        <div className="space-y-5">
          <ErrorBox>
            {linkError
              ? 'Der Link ist abgelaufen oder wurde schon benutzt.'
              : 'Bitte öffne den Link aus deiner E-Mail erneut.'}{' '}
            Einen neuen Link bekommst du über „Passwort vergessen“.
          </ErrorBox>
          <Link to="/login/passwort-vergessen" className="btn-gold w-full">
            Neuen Link anfordern
          </Link>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(pw, repeat);
    if (problem) return setError(problem);
    if (!authClient) return;
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      if (err.code === 'insufficient_aal') {
        navigate('/login/2fa?next=%2Flogin%2Fneues-passwort');
        return;
      }
      setError(
        err.code === 'same_password'
          ? 'Bitte wähle ein anderes Passwort als bisher.'
          : err.code === 'weak_password'
            ? 'Dieses Passwort ist zu schwach.'
            : 'Das Passwort konnte nicht gespeichert werden.',
      );
      return;
    }
    await refresh();
    navigate('/login/2fa', { replace: true });
  };

  return (
    <AuthShell title="Passwort festlegen">
      <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
        <p className="text-ink-soft">
          Für <strong className="text-ink">{session.user.email}</strong>. Mindestens 10 Zeichen mit
          Buchstaben und Ziffern.
        </p>
        <input
          type="email"
          autoComplete="username"
          value={session.user.email ?? ''}
          readOnly
          hidden
        />
        <div>
          <label htmlFor="pw" className="field-label">
            Neues Passwort
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            className="field-input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="repeat" className="field-label">
            Passwort wiederholen
          </label>
          <input
            id="repeat"
            type="password"
            autoComplete="new-password"
            className="field-input"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="submit" className="btn-gold w-full" disabled={busy}>
          {busy ? 'Speichern …' : 'Passwort speichern'}
        </button>
      </form>
    </AuthShell>
  );
}
