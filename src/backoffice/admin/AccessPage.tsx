import { useState, type FormEvent } from 'react';
import { useAuth } from '../AuthProvider';
import { requireClient } from '../authClient';
import { ROLE_LABEL, type Role } from '../roles';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader, Panel, SuccessBox, dangerBtn, smallBtn } from '../ui';
import { callAdmin } from './api';
import { formatDateTime } from './format';
import type { AccessRow } from './types';
import { unwrap, useLoad } from './useLoad';

export function AccessPage() {
  const { session } = useAuth();
  const list = useLoad(
    async () => unwrap(await requireClient().rpc('admin_list_access')) as AccessRow[],
    [],
  );
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('haendler');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await callAdmin<{ invited: boolean }>('invite_user', { email, role });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({
      ok: true,
      text: r.invited
        ? `Einladung an ${email} verschickt. Der Link ist 24 Stunden gültig.`
        : `${email} hat schon ein Konto und bekommt jetzt die Rolle „${ROLE_LABEL[role]}“.`,
    });
    setEmail('');
    list.reload();
  };

  const rpc = async (name: string, args: Record<string, unknown>, ok: string) => {
    setMsg(null);
    const { error } = await requireClient().rpc(name, args);
    setMsg(error ? { ok: false, text: errorText(error) } : { ok: true, text: ok });
    setConfirmRevoke(null);
    list.reload();
  };

  return (
    <>
      <PageHeader title="Zugänge" />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel title="Personen mit Zugang">
          {list.loading && !list.data && <Loading />}
          {list.error != null && <ErrorBox>{errorText(list.error)}</ErrorBox>}
          {list.data && (
            <ul className="divide-y divide-line">
              {list.data.map((u) => {
                const self = u.user_id === session?.user.id;
                const current = (
                  u.roles.includes('studio_admin') ? 'studio_admin' : 'haendler'
                ) as Role;
                return (
                  <li key={u.user_id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {u.email}{' '}
                          {self && <span className="text-sm font-normal text-ink-soft">(du)</span>}
                        </div>
                        <div className="mt-1 text-sm text-ink-soft">
                          {u.has_2fa ? '2FA aktiv' : '2FA nicht eingerichtet'} · Letzte Anmeldung:{' '}
                          {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'noch nie'}
                          {u.invited_at &&
                            !u.last_sign_in_at &&
                            ` · eingeladen am ${formatDateTime(u.invited_at)}`}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`role-${u.user_id}`}>
                          Rolle von {u.email}
                        </label>
                        <select
                          id={`role-${u.user_id}`}
                          className="field-input min-h-11 w-auto py-2 text-sm"
                          value={current}
                          disabled={self}
                          onChange={(e) =>
                            void rpc(
                              'admin_set_role',
                              { p_user_id: u.user_id, p_role: e.target.value },
                              'Rolle geändert.',
                            )
                          }
                        >
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                        {!self && (
                          <button
                            type="button"
                            className={smallBtn}
                            onClick={() => setConfirmRevoke(u.user_id)}
                          >
                            Zugang entziehen
                          </button>
                        )}
                      </div>
                    </div>
                    {confirmRevoke === u.user_id && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-950">
                        <span>{u.email} verliert sofort jeden Zugriff.</span>
                        <button
                          type="button"
                          className={dangerBtn}
                          onClick={() =>
                            void rpc(
                              'admin_revoke_access',
                              { p_user_id: u.user_id },
                              'Zugang entzogen.',
                            )
                          }
                        >
                          Entziehen
                        </button>
                        <button
                          type="button"
                          className={smallBtn}
                          onClick={() => setConfirmRevoke(null)}
                        >
                          Abbrechen
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Einladen">
          <form onSubmit={(e) => void invite(e)} className="space-y-4" noValidate>
            <label className="block">
              <span className="field-label">E-Mail</span>
              <input
                type="email"
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="field-label">Rolle</span>
              <select
                className="field-input"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-ink-soft">
              Admins müssen bei der ersten Anmeldung die Zwei-Faktor-Anmeldung einrichten. Händler
              sehen keine Kontaktdaten der Gäste.
            </p>
            <button
              type="submit"
              className="btn-gold w-full"
              disabled={busy || !email.includes('@')}
            >
              {busy ? 'Senden …' : 'Einladung senden'}
            </button>
          </form>
        </Panel>
      </div>
      {msg && (
        <div className="mt-6">
          {msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>}
        </div>
      )}
    </>
  );
}
