import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { DEMO } from './lib/demo';
import { BookingSuccessPage } from './pages/BookingSuccessPage';
import { ErrorPage } from './pages/ErrorPage';
import { HomePage } from './pages/HomePage';
import { AgbPage } from './pages/legal/AgbPage';
import { DatenschutzPage } from './pages/legal/DatenschutzPage';
import { ImpressumPage } from './pages/legal/ImpressumPage';
import { NewsletterConfirmedPage } from './pages/NewsletterConfirmedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TicketPage } from './pages/TicketPage';

// Backoffice (Login, Admin, Händler) als eigene Bundles – die öffentliche Seite lädt davon nichts.
const lazyDefault = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

const pages: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/buchung/erfolg', element: <BookingSuccessPage /> },
  { path: '/ticket/:token', element: <TicketPage /> },
  { path: '/newsletter/bestaetigt', element: <NewsletterConfirmedPage /> },
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
