/**
 * Vorschau-Modus mit Beispieldaten (npm run build:preview). Ohne Datenbank, ohne Zahlung.
 * Im normalen Build ist DEMO eine Konstante `false` – der Demo-Code wird dann komplett entfernt.
 */
export const DEMO = import.meta.env.VITE_DEMO === 'true';
