import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { decideAccess } from './roles';
import { NoAccessPage } from './auth/NoAccessPage';
import { Loading } from './ui';

/** Schützt /admin und /haendler. Die Datenbank prüft trotzdem jede Abfrage selbst (RLS, aal2). */
export function RequireAccess({
  area,
  children,
}: {
  area: 'admin' | 'haendler';
  children: ReactNode;
}) {
  const { loading, session, roles, aal } = useAuth();
  const location = useLocation();
  if (loading) return <Loading full />;
  const next = encodeURIComponent(location.pathname + location.search);
  switch (decideAccess(Boolean(session), roles, aal, area)) {
    case 'login':
      return <Navigate to={`/login?next=${next}`} replace />;
    case 'two_factor':
      return <Navigate to={`/login/2fa?next=${next}`} replace />;
    case 'no_access':
      return <NoAccessPage />;
    case 'ok':
      return <>{children}</>;
  }
}
