import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchPublicSettings } from './api';
import { PUBLIC_SETTINGS_FALLBACK, type PublicSettings } from './settings';

interface SettingsState {
  settings: PublicSettings;
  /** true, sobald die Werte aus der Datenbank geladen sind. */
  loaded: boolean;
}

const SettingsContext = createContext<SettingsState>({
  settings: PUBLIC_SETTINGS_FALLBACK,
  loaded: false,
});

/** Lädt get_public_settings() einmal beim Start. Bis dahin gelten die Startwerte. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>({
    settings: PUBLIC_SETTINGS_FALLBACK,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings()
      .then((settings) => !cancelled && setState({ settings, loaded: true }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return <SettingsContext.Provider value={state}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): PublicSettings {
  return useContext(SettingsContext).settings;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettingsLoaded(): boolean {
  return useContext(SettingsContext).loaded;
}
