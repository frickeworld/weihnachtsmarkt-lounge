/**
 * Registriert den Service Worker des Scanners (nur /scan), damit die Seite auch ohne Netz öffnet.
 * Danach meldet die Seite alle bereits geladenen eigenen Dateien, damit sie gespeichert werden –
 * auch die, die vor dem ersten Start des Workers geladen wurden (z. B. Kamera-Modul).
 */
export function registerScannerShell(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  const report = (worker: ServiceWorker | null | undefined) => {
    if (!worker) return;
    const urls = [
      window.location.href.split('#')[0]!,
      ...performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(window.location.origin)),
    ];
    worker.postMessage({ type: 'cache', urls });
  };
  navigator.serviceWorker
    .register(`${base}scan-sw.js`, { scope: `${base}scan` })
    .then(async (reg) => {
      await navigator.serviceWorker.ready;
      report(reg.active);
      // Später nachgeladene Teile (Kamera, Ergebnisanzeige) ebenfalls speichern
      window.setTimeout(() => report(reg.active), 15_000);
    })
    .catch(() => undefined);
}
