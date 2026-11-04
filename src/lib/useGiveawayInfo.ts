import { useEffect, useState } from 'react';
import { fetchGiveawayInfo, type GiveawayInfo } from './api';

/** Eckdaten des Gewinnspiels (einmal je Seitenaufruf geladen, von mehreren Bausteinen geteilt). */
export function useGiveawayInfo(): GiveawayInfo | null {
  const [info, setInfo] = useState<GiveawayInfo | null>(null);
  useEffect(() => {
    let active = true;
    void fetchGiveawayInfo().then((i) => active && setInfo(i));
    return () => {
      active = false;
    };
  }, []);
  return info;
}
