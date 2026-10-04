import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { authClient } from '../authClient';
import { decideAccess, homeFor, safeNext } from '../roles';
import { ErrorBox, Loading } from '../ui';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const { loading, session, roles, aal, refresh } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading full />;
  if (session && !busy) {
    // Schon angemeldet: weiter zur 2FA oder in den Bereich.
    const area = (next ?? homeFor(roles)).startsWith('/admin') ? 'admin' : 'haendler';
    const d = decideAccess(true, roles, aal, area);
    if (d === 'two_factor')
      return (
        <Navigate to={`/login/2fa${next ? `?next=${encodeURIComponent(next)}` : ''}`} replace />
      );
    return <Navigate to={next ?? homeFor(roles)} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authClient) return setError('Die Anmeldung ist noch nicht eingerichtet.');
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setBusy(false);
      setError(
        err.status === 429
          ? 'Zu viele Versuche. Bitte warte einen Moment.'
          : 'E-Mail-Adresse oder Passwort stimmen nicht.',
      );
      return;
    }
    await refresh();
    setBusy(false);
    navigate(`/login/2fa${next ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true });
  };

  return (
    <AuthShell title="Anmelden">
      <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="field-label">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="submit" className="btn-gold w-full" disabled={busy || !email || !password}>
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
        <p className="text-center text-sm">
          <Link
            to="/login/passwort-vergessen"
            className="font-semibold text-gold-deep underline underline-offset-4"
          >
            Passwort vergessen?
          </Link>
        </p>
        <p className="text-center text-sm text-ink-soft">
          Zugänge gibt es nur per Einladung von Studio F.
        </p>
      </form>
    </AuthShell>
  );
}
