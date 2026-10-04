import { useState } from 'react';
import { addDays, todayInBerlin } from '@/lib/dates';
import { useSettings } from '@/lib/settingsContext';

export type Preset = 'saison' | 'heute' | '7' | '30' | 'eigen';
export interface Period {
  from: string;
  to: string;
}

/** Zeitraum-Auswahl (Saison, Heute, 7/30 Tage, frei). Saison kommt aus den öffentlichen Einstellungen. */
export function usePeriod(initial: Preset = 'saison') {
  const { seasonStart, seasonEnd } = useSettings();
  const today = todayInBerlin();
  const [preset, setPreset] = useState<Preset>(initial);
  const [custom, setCustom] = useState<Period>({ from: seasonStart, to: seasonEnd });
  const period: Period =
    preset === 'heute'
      ? { from: today, to: today }
      : preset === '7'
        ? { from: addDays(today, -6), to: today }
        : preset === '30'
          ? { from: addDays(today, -29), to: today }
          : preset === 'eigen'
            ? custom
            : { from: seasonStart, to: seasonEnd };
  return { preset, setPreset, custom, setCustom, period };
}
