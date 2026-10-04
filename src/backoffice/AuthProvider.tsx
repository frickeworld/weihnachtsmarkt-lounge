import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authClient } from './authClient';
import type { Aal, Role } from './roles';

interface AuthState {
  loading: boolean;
  session: Session | null;
  roles: Role[];
  aal: Aal;
  /** Rollen und 2FA-Stufe neu lesen (nach 2FA-Bestätigung). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const NO_AAL: Aal = { current: null, next: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refresh' | 'signOut'>>({
    loading: true,
    session: null,
    roles: [],
    aal: NO_AAL,
  });

  const load = useCallback(async (session: Session | null) => {
    if (!authClient || !session) {
      setState({ loading: false, session: null, roles: [], aal: NO_AAL });
      return;
    }
    const [{ data: roleRows }, { data: aal }] = await Promise.all([
      authClient.from('user_roles').select('role').eq('user_id', session.user.id),
      authClient.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setState({
      loading: false,
      session,
      roles: ((roleRows ?? []) as { role: Role }[]).map((r) => r.role),
      aal: { current: aal?.currentLevel ?? null, next: aal?.nextLevel ?? null } as Aal,
    });
  }, []);

  useEffect(() => {
    if (!authClient) {
      void Promise.resolve().then(() => load(null));
      return;
    }
    const client = authClient;
    void client.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      // Nicht im Callback awaiten (supabase-js sperrt sonst weitere Auth-Aufrufe).
      if (event === 'INITIAL_SESSION') return;
      setTimeout(() => void load(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!authClient) return;
    const { data } = await authClient.auth.getSession();
    await load(data.session);
  }, [load]);

  const signOut = useCallback(async () => {
    await authClient?.auth.signOut();
    await load(null);
  }, [load]);

  return (
    <AuthContext.Provider value={{ ...state, refresh, signOut }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook gehört zum Provider
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb von AuthProvider');
  return ctx;
}
