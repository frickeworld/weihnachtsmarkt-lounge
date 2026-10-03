import { createContext, useContext, type ReactNode } from 'react';
import { PUBLIC_SETTINGS_FALLBACK, type PublicSettings } from './settings';

const SettingsContext = createContext<PublicSettings>(PUBLIC_SETTINGS_FALLBACK);

export function SettingsProvider({
  value = PUBLIC_SETTINGS_FALLBACK,
  children,
}: {
  value?: PublicSettings;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): PublicSettings {
  return useContext(SettingsContext);
}
