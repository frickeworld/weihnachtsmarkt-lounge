/* Service Worker nur für den Einlass-Scanner (Geltungsbereich /scan).
 * Speichert die Scanner-Seite und ihre Dateien auf dem Handy, damit /scan auch ohne Netz öffnet.
 * - Seitenaufruf: erst Netz (immer der neueste Stand), ohne Netz die gespeicherte Seite.
 * - Dateien der eigenen Seite (gehashte JS/CSS/Schriften): aus dem Speicher, sonst Netz.
 * - Anfragen an Supabase (andere Adresse) laufen nie hierüber – Daten kommen immer frisch.
 */
const CACHE = 'scanner-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Die Seite meldet, welche Dateien sie geladen hat (auch vor dem ersten Start dieses Workers).
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'cache' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => {
    try {
      return new URL(u).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        urls.map((u) =>
          fetch(u, { credentials: 'same-origin' })
            .then((res) => (res.ok ? cache.put(u, res) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const shell = self.registration.scope;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(shell, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(shell, { ignoreVary: true })
            .then((hit) => hit || caches.match(req, { ignoreVary: true }))
            .then((hit) => hit || Response.error()),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && /\.(js|css|woff2|png|webp|svg)$/.test(url.pathname)) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
