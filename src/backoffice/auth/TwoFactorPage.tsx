import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { authClient } from '../authClient';
import { homeFor, safeNext } from '../roles';
import { ErrorBox, Loading, smallBtn } from '../ui';
import { AuthShell } from './AuthShell';

type Mode =
  | { kind: 'loading' }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/**
 * Zweiter Faktor (TOTP, z. B. Google Authenticator, 1Password, Microsoft Authenticator).
 * Admins müssen ihn einrichten, Händler können (Parameter ?einrichten=1).
 */
export function TwoFactorPage() {
  const { loading, session, roles, aal, refresh, signOut } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const voluntary = params.get('einrichten') === '1';
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const isAdmin = roles.includes('studio_admin');
  const aalCurrent = aal.current;
  const target = next ?? homeFor(roles);

  useEffect(() => {
    if (loading || !session || !authClient || started.current) return;
    started.current = true;
    const client = authClient;
    void (async () => {
      const { data, error: listError } = await client.auth.mfa.listFactors();
      if (listError)
        return setMode({ kind: 'error', message: 'Die 2FA konnte nicht geladen werden.' });
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) {
        if (aalCurrent === 'aal2') return setMode({ kind: 'done' });
        return setMode({ kind: 'verify', factorId: verified.id });
      }
      if (!isAdmin && !voluntary) return setMode({ kind: 'done' });
      // Abgebrochene Einrichtungen aufräumen, sonst lehnt Supabase einen neuen Faktor ab.
      for (const f of data.all.filter((x) => x.status === 'unverified'))
        await client.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
        issuer: 'Lounge der Händler',
      });
      if (enrollError || !enrolled)
        return setMode({ kind: 'error', message: 'Die 2FA konnte nicht eingerichtet werden.' });
      setMode({
        kind: 'enroll',
        factorId: enrolled.id,
        qr: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
    })();
  }, [loading, session, aalCurrent, isAdmin, voluntary]);

  if (loading) return <Loading full />;
  if (!session) return <Navigate to="/login" replace />;
  if (mode.kind === 'done') return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!authClient || (mode.kind !== 'verify' && mode.kind !== 'enroll')) return;
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.auth.mfa.challengeAndVerify({
      factorId: mode.factorId,
      code: code.replace(/\s/g, ''),
    });
    if (err) {
      setBusy(false);
      setError(
        err.status === 429
          ? 'Zu viele Versuche. Bitte warte einen Moment.'
          : 'Der Code stimmt nicht. Bitte nimm den aktuellen Code aus deiner App.',
      );
      setCode('');
      return;
    }
    await refresh();
    navigate(target, { replace: true });
  };

  const codeForm = (
    <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
      <div>
        <label htmlFor="code" className="field-label">
          6-stelliger Code
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          autoFocus
          className="field-input text-center font-display text-2xl tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button
        type="submit"
        className="btn-gold w-full"
        disabled={busy || code.replace(/\s/g, '').length !== 6}
      >
        {busy ? 'Prüfen …' : 'Bestätigen'}
      </button>
    </form>
  );

  return (
    <AuthShell
      title={mode.kind === 'enroll' ? 'Zwei-Faktor-Anmeldung einrichten' : 'Bestätigungscode'}
    >
      {mode.kind === 'loading' && <Loading />}
      {mode.kind === 'error' && <ErrorBox>{mode.message}</ErrorBox>}
      {mode.kind === 'verify' && (
        <div className="space-y-5">
          <p className="text-ink-soft">Gib den aktuellen Code aus deiner Authenticator-App ein.</p>
          {codeForm}
        </div>
      )}
      {mode.kind === 'enroll' && (
        <div className="space-y-5">
          <ol className="list-decimal space-y-2 pl-5 text-ink-soft">
            <li>Öffne eine Authenticator-App (z. B. Google Authenticator, 1Password).</li>
            <li>Scanne den QR-Code oder gib den Schlüssel von Hand ein.</li>
            <li>Gib den angezeigten 6-stelligen Code ein.</li>
          </ol>
          <div className="flex justify-center rounded-xl border border-line bg-white p-4">
            <img src={mode.qr} alt="QR-Code für die Authenticator-App" className="h-48 w-48" />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-gold-deep">
              Schlüssel zum Abtippen anzeigen
            </summary>
            <code className="mt-2 block break-all rounded-lg bg-sand p-3 font-mono">
              {mode.secret}
            </code>
          </details>
          {codeForm}
        </div>
      )}
      <div className="mt-6 border-t border-line pt-5 text-center">
        <button type="button" className={smallBtn} onClick={() => void signOut()}>
          Abmelden
        </button>
      </div>
    </AuthShell>
  );
}
