import { useMemo } from 'react';
import { todayInBerlin, type IsoDate } from './dates';
import { useSettings } from './settingsContext';
import { specialDay, type SpecialDay } from './specialDays';

/**
 * Besonderer Tag von heute (Berliner Zeit). Zum Ausprobieren lässt sich das Datum mit
 * `?tag=2026-12-06` in der Adresszeile setzen – das ändert nur die Dekoration.
 */
export function useSpecialDay(): SpecialDay | null {
  const s = useSettings();
  return useMemo(() => {
    const param =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tag');
    const today: IsoDate = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : todayInBerlin();
    return specialDay(today, s.seasonStart, s.seasonEnd);
  }, [s.seasonStart, s.seasonEnd]);
}
