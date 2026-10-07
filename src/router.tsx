import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { DEMO } from './lib/demo';
import { ErrorPage } from './pages/ErrorPage';
import { HomePage } from './pages/HomePage';
import { AgbPage } from './pages/legal/AgbPage';
import { DatenschutzPage } from './pages/legal/DatenschutzPage';
import { ImpressumPage } from './pages/legal/ImpressumPage';
import { NewsletterConfirmedPage } from './pages/NewsletterConfirmedPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Backoffice (Login, Admin, Händler) als eigene Bundles – die öffentliche Seite lädt davon nichts.
const lazyDefault = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

const pages: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  // Erfolgsseite (Taler-Regen, Countdown) und Online-Ticket (QR-Code) als eigene Bundles
  {
    path: '/buchung/erfolg',
    lazy: async () => ({
      Component: (await import('./pages/BookingSuccessPage')).BookingSuccessPage,
    }),
  },
  {
    path: '/ticket/:token',
    lazy: async () => ({ Component: (await import('./pages/TicketPage')).TicketPage }),
  },
  { path: '/newsletter/bestaetigt', element: <NewsletterConfirmedPage /> },
  // Gewinnspiel als eigenes Bundle
  {
    path: '/gewinnspiel',
    lazy: async () => ({ Component: (await import('./pages/GiveawayPage')).GiveawayPage }),
  },
  {
    path: '/gewinnspiel/bestaetigt',
    lazy: async () => {
      const { GiveawayTokenPage } = await import('./pages/GiveawayTokenPage');
      return { Component: () => <GiveawayTokenPage mode="confirm" /> };
    },
  },
  {
    path: '/gewinnspiel/abmelden',
    lazy: async () => {
      const { GiveawayTokenPage } = await import('./pages/GiveawayTokenPage');
      return { Component: () => <GiveawayTokenPage mode="unsubscribe" /> };
    },
  },
  {
    path: '/gewinnspiel/teilnahmebedingungen',
    lazy: async () => ({
      Component: (await import('./pages/legal/GiveawayTermsPage')).GiveawayTermsPage,
    }),
  },
  { path: '/impressum', element: <ImpressumPage /> },
  { path: '/datenschutz', element: <DatenschutzPage /> },
  { path: '/agb', element: <AgbPage /> },
  { path: '/login/*', lazy: lazyDefault(() => import('./backoffice/LoginRoutes')) },
  { path: '/admin/*', lazy: lazyDefault(() => import('./backoffice/admin/AdminRoutes')) },
  { path: '/haendler/*', lazy: lazyDefault(() => import('./backoffice/haendler/HaendlerRoutes')) },
  { path: '/scan', lazy: lazyDefault(() => import('./scanner/ScannerApp')) },
  { path: '*', element: <NotFoundPage /> },
];

// Fehler in einer Seite (oder ein veraltetes Bundle nach einem Update) zeigen eine freundliche Seite.
const routes: RouteObject[] = [{ errorElement: <ErrorPage />, children: pages }];

// Vorschau (Artifact) läuft unter fremder URL – dort navigiert der Router nur im Speicher.
export const router = DEMO ? createMemoryRouter(routes) : createBrowserRouter(routes);
