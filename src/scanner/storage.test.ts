// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { berlinToday, store } from './storage';
import type { TodayList } from './types';

const list = (date: string): TodayList => ({ date, checkin_early_minutes: 30, bookings: [] });

describe('Scanner-Speicher (übersteht das Schließen des Tabs)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('Tagesliste nur für heute', () => {
    store.setToday(list(berlinToday()));
    expect(store.today()?.date).toBe(berlinToday());
    store.setToday(list('2020-12-05'));
    expect(store.today()).toBeNull();
  });

  it('liegt im dauerhaften Speicher, nicht nur im Tab', () => {
    store.setQueue([{ type: 'taler', bookingId: 'b1', scannedAt: '2026-12-05T17:00:00Z' }]);
    expect(localStorage.getItem('scanner.queue')).toContain('b1');
  });

  it('Abmelden löscht Anmeldung und Liste, nicht übertragene Check-ins bleiben', () => {
    store.setSession({ token: 't', expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    store.setToday(list(berlinToday()));
    store.setQueue([{ type: 'taler', bookingId: 'b1', scannedAt: '2026-12-05T17:00:00Z' }]);
    store.clear();
    expect(store.session()).toBeNull();
    expect(store.today()).toBeNull();
    expect(store.queue()).toHaveLength(1);
  });

  it('übernimmt Daten aus dem alten Tab-Speicher', () => {
    sessionStorage.setItem(
      'scanner.queue',
      JSON.stringify([{ type: 'taler', bookingId: 'b2', scannedAt: 'x' }]),
    );
    expect(store.queue()[0]).toMatchObject({ bookingId: 'b2' });
  });

  it('abgelaufene Anmeldung zählt nicht', () => {
    store.setSession({ token: 't', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(store.session()).toBeNull();
  });
});
