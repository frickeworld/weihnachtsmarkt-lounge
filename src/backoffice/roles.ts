export type Role = 'studio_admin' | 'haendler';

export const ROLE_LABEL: Record<Role, string> = {
  studio_admin: 'Studio F (Admin)',
  haendler: 'Händler (nur lesen)',
};

export interface Aal {
  current: 'aal1' | 'aal2' | null;
  /** aal2, sobald ein bestätigter zweiter Faktor existiert. */
  next: 'aal1' | 'aal2' | null;
}

/**
 * Entscheidet, wohin jemand nach der Anmeldung bzw. beim Aufruf eines Bereichs muss.
 * - Admins brauchen immer 2FA (aal2), auch zum Einrichten.
 * - Händler brauchen 2FA nur, wenn sie sie eingerichtet haben.
 */
export type AccessDecision = 'login' | 'two_factor' | 'no_access' | 'ok';

export function decideAccess(
  signedIn: boolean,
  roles: Role[],
  aal: Aal,
  area: 'admin' | 'haendler',
): AccessDecision {
  if (!signedIn) return 'login';
  const isAdmin = roles.includes('studio_admin');
  const allowed = area === 'admin' ? isAdmin : isAdmin || roles.includes('haendler');
  if (!allowed) return 'no_access';
  const needsAal2 = isAdmin || aal.next === 'aal2';
  if (needsAal2 && aal.current !== 'aal2') return 'two_factor';
  return 'ok';
}

/** Startseite nach der Anmeldung. */
export function homeFor(roles: Role[]): string {
  if (roles.includes('studio_admin')) return '/admin';
  if (roles.includes('haendler')) return '/haendler';
  return '/login/kein-zugang';
}

/** Nur interne Pfade als Rücksprungziel erlauben (kein Open Redirect). */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return null;
  return next;
}
