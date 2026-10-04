import { describe, expect, it } from 'vitest';
import { decideAccess, homeFor, safeNext } from './roles';

const aal1 = { current: 'aal1', next: 'aal1' } as const;
const aal1WithFactor = { current: 'aal1', next: 'aal2' } as const;
const aal2 = { current: 'aal2', next: 'aal2' } as const;

describe('decideAccess', () => {
  it('ohne Anmeldung → Login', () => {
    expect(decideAccess(false, [], aal1, 'admin')).toBe('login');
  });
  it('Admin braucht immer 2FA', () => {
    expect(decideAccess(true, ['studio_admin'], aal1, 'admin')).toBe('two_factor');
    expect(decideAccess(true, ['studio_admin'], aal1, 'haendler')).toBe('two_factor');
    expect(decideAccess(true, ['studio_admin'], aal2, 'admin')).toBe('ok');
  });
  it('Händler: 2FA optional, aber Pflicht sobald eingerichtet', () => {
    expect(decideAccess(true, ['haendler'], aal1, 'haendler')).toBe('ok');
    expect(decideAccess(true, ['haendler'], aal1WithFactor, 'haendler')).toBe('two_factor');
  });
  it('Händler kommt nicht in den Admin, Nutzer ohne Rolle nirgends hin', () => {
    expect(decideAccess(true, ['haendler'], aal2, 'admin')).toBe('no_access');
    expect(decideAccess(true, [], aal2, 'haendler')).toBe('no_access');
  });
});

describe('homeFor / safeNext', () => {
  it('leitet nach Rolle weiter', () => {
    expect(homeFor(['haendler', 'studio_admin'])).toBe('/admin');
    expect(homeFor(['haendler'])).toBe('/haendler');
    expect(homeFor([])).toBe('/login/kein-zugang');
  });
  it('erlaubt nur interne Pfade', () => {
    expect(safeNext('/admin/buchungen')).toBe('/admin/buchungen');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('/\\evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
