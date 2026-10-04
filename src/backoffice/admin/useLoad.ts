import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lädt Daten, sobald sich die Abhängigkeiten ändern; `reload` lädt erneut.
 * Daten gelten nur für die Abhängigkeiten, mit denen sie geladen wurden (z. B. Monat im
 * Kalender). Beim `reload` bleiben die alten Daten bis zur Antwort sichtbar.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: unknown }>({
    key: null,
    data: null,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const key = JSON.stringify(deps);
  useEffect(() => {
    let active = true;
    fnRef.current().then(
      (data) => active && setState({ key, data, error: null }),
      (error: unknown) => active && setState({ key, data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
    reload,
  };
}

/** Wirft den Supabase-Fehler weiter, damit useLoad ihn anzeigt. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
