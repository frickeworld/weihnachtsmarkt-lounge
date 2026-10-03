import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiUnavailableError, fetchAvailability } from './api';
import { groupByDate, type SlotAvailability } from './availability';
import type { IsoDate } from './dates';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unconfigured';

type ByDate = Map<IsoDate, SlotAvailability[]>;

interface Result {
  key: string;
  status: 'ready' | 'error' | 'unconfigured';
  byDate: ByDate;
}

const EMPTY: ByDate = new Map();

async function load(from: IsoDate, to: IsoDate): Promise<Result> {
  const key = `${from}/${to}`;
  try {
    return { key, status: 'ready', byDate: groupByDate(await fetchAvailability(from, to)) };
  } catch (e) {
    return {
      key,
      status: e instanceof ApiUnavailableError ? 'unconfigured' : 'error',
      byDate: EMPTY,
    };
  }
}

/**
 * Lädt die Verfügbarkeit für einen Zeitraum aus get_availability().
 * Wird erst aktiv, wenn `enabled` true ist (Buchungsbereich geöffnet), und lässt sich per reload()
 * nach jeder Auswahl neu laden. Veraltete Antworten werden verworfen.
 */
export function useAvailability(from: IsoDate, to: IsoDate, enabled: boolean) {
  const key = `${from}/${to}`;
  const [result, setResult] = useState<Result | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async (): Promise<ByDate | null> => {
    const id = ++requestId.current;
    const r = await load(from, to);
    if (id !== requestId.current) return null;
    setResult(r);
    return r.status === 'ready' ? r.byDate : null;
  }, [from, to]);

  useEffect(() => {
    if (!enabled) return;
    const id = ++requestId.current;
    void load(from, to).then((r) => {
      if (id === requestId.current) setResult(r);
    });
  }, [enabled, from, to]);

  const current = result?.key === key ? result : null;
  const state: LoadState = current ? current.status : enabled ? 'loading' : 'idle';
  return { byDate: current?.byDate ?? EMPTY, state, reload };
}
