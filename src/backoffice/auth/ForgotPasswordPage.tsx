import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authClient, newPasswordUrl } from '../authClient';
import { ErrorBox, SuccessBox } from '../ui';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authClient) return;
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: newPasswordUrl(),
    });
    setBusy(false);
    // Aus Datenschutzgründen immer dieselbe Antwort – egal, ob es die Adresse gibt.
    if (err?.status === 429) setError('Zu viele Anfragen. Bitte versuche es später erneut.');
    else setSent(true);
  };

  return (
    <AuthShell title="Passwort vergessen">
      {sent ? (
        <div className="space-y-5">
          <SuccessBox>
            Wenn es zu dieser Adresse einen Zugang gibt, haben wir dir einen Link zum Zurücksetzen
            geschickt. Bitte schau auch im Spam-Ordner nach.
          </SuccessBox>
          <Link to="/login" className="btn-outline w-full">
            Zur Anmeldung
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <p className="text-ink-soft">
            Gib deine E-Mail-Adresse ein. Du bekommst einen Link, mit dem du ein neues Passwort
            festlegst.
          </p>
          <div>
            <label htmlFor="email" className="field-label">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" className="btn-gold w-full" disabled={busy || !email.includes('@')}>
            {busy ? 'Senden …' : 'Link anfordern'}
          </button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-semibold text-gold-deep underline underline-offset-4">
              Zurück zur Anmeldung
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
