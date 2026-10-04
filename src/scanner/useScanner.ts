import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthError, OfflineError, scannerApi } from './api';
import { evaluateOffline, talerOffline } from './offline';
import { store, type ScannerSession } from './storage';
import type { QueueItem, ScanBooking, ScanResult, TodayList } from './types';

const SYNC_MS = 30_000;

/**
 * Scanner-Zustand: Liste „Heute“, Online-Status und Warteschlange für Offline-Check-ins.
 * Offline geprüfte Check-ins/Taler werden nachgetragen, sobald wieder Netz da ist; der Server
 * überschreibt dabei nie einen vorhandenen Check-in.
 */
export function useScanner(session: ScannerSession, onLogout: (message?: string) => void) {
  const [today, setTodayState] = useState<TodayList | null>(() => store.today());
  const [queue, setQueueState] = useState<QueueItem[]>(() => store.queue());
  const [online, setOnline] = useState(true);
  const syncing = useRef(false);
  const todayRef = useRef(today);
  const queueRef = useRef(queue);

  const setToday = useCallback((t: TodayList | null) => {
    todayRef.current = t;
    store.setToday(t);
    setTodayState(t);
  }, []);
  const setQueue = useCallback((q: QueueItem[]) => {
    queueRef.current = q;
    store.setQueue(q);
    setQueueState(q);
  }, []);
  const mergeBooking = useCallback(
    (b?: ScanBooking) => {
      const t = todayRef.current;
      if (!b || !t) return;
      setToday({ ...t, bookings: t.bookings.map((x) => (x.id === b.id ? { ...x, ...b } : x)) });
    },
    [setToday],
  );

  const handle = useCallback(
    (e: unknown): 'offline' | 'auth' | 'error' => {
      if (e instanceof OfflineError) {
        setOnline(false);
        return 'offline';
      }
      if (e instanceof AuthError) {
        onLogout('Bitte melde dich mit der PIN neu an.');
        return 'auth';
      }
      return 'error';
    },
    [onLogout],
  );

  const refreshToday = useCallback(async () => {
    try {
      const t = await scannerApi.today(session.token);
      setOnline(true);
      // Noch nicht nachgetragene Offline-Check-ins nicht überschreiben
      if (queueRef.current.length === 0) setToday(t);
    } catch (e) {
      handle(e);
    }
  }, [session.token, setToday, handle]);

  const sync = useCallback(async () => {
    if (syncing.current || queueRef.current.length === 0) return;
    syncing.current = true;
    try {
      while (queueRef.current.length) {
        const item = queueRef.current[0]!;
        try {
          if (item.type === 'scan')
            await scannerApi.scan(session.token, item.code, item.override, true, item.scannedAt);
          else await scannerApi.taler(session.token, item.bookingId, true, item.scannedAt);
          setOnline(true);
        } catch (e) {
          const kind = handle(e);
          if (kind !== 'error') return; // offline oder abgemeldet: später erneut
        }
        setQueue(queueRef.current.slice(1));
      }
    } finally {
      syncing.current = false;
    }
    await refreshToday();
  }, [session.token, setQueue, handle, refreshToday]);

  useEffect(() => {
    const first = setTimeout(() => void refreshToday().then(() => sync()), 0);
    const goOnline = () => void sync().then(() => refreshToday());
    window.addEventListener('online', goOnline);
    const timer = setInterval(() => {
      if (queueRef.current.length) void sync();
      else void refreshToday();
    }, SYNC_MS);
    return () => {
      window.removeEventListener('online', goOnline);
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refreshToday, sync]);

  const scan = useCallback(
    async (code: string, override = false): Promise<ScanResult> => {
      try {
        const r = await scannerApi.scan(session.token, code, override);
        setOnline(true);
        mergeBooking(r.booking);
        if (queueRef.current.length) void sync();
        return r;
      } catch (e) {
        const kind = handle(e);
        if (kind === 'auth') return { result: 'invalid', reason: 'unknown' };
        if (kind === 'error') throw e;
        const t = todayRef.current;
        if (!t) return { result: 'invalid', reason: 'nolist', offline: true };
        const now = new Date();
        const r = await evaluateOffline(code, t, now, override);
        if (r.result.result === 'ok' || r.result.result === 'override') {
          setToday(r.today);
          setQueue([
            ...queueRef.current,
            { type: 'scan', code, override, scannedAt: now.toISOString() },
          ]);
        }
        return r.result;
      }
    },
    [session.token, mergeBooking, handle, setToday, setQueue, sync],
  );

  const taler = useCallback(
    async (bookingId: string): Promise<ScanBooking | undefined> => {
      try {
        const r = await scannerApi.taler(session.token, bookingId);
        setOnline(true);
        mergeBooking(r.booking);
        return r.booking;
      } catch (e) {
        const kind = handle(e);
        if (kind === 'error') throw e;
        if (kind === 'auth') return undefined;
        const t = todayRef.current;
        if (!t) return undefined;
        const now = new Date();
        const next = talerOffline(bookingId, t, now);
        setToday(next);
        setQueue([...queueRef.current, { type: 'taler', bookingId, scannedAt: now.toISOString() }]);
        return next.bookings.find((b) => b.id === bookingId);
      }
    },
    [session.token, mergeBooking, handle, setToday, setQueue],
  );

  return { today, queue, online, scan, taler, refreshToday, sync };
}
