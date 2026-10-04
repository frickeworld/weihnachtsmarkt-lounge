import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { DEMO } from './lib/demo';
import { BookingSuccessPage } from './pages/BookingSuccessPage';
import { HomePage } from './pages/HomePage';
import { LegalPlaceholderPage } from './pages/LegalPlaceholderPage';
import { NewsletterConfirmedPage } from './pages/NewsletterConfirmedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TicketPage } from './pages/TicketPage';

// Backoffice (Login, Admin, Händler) als eigene Bundles – die öffentliche Seite lädt davon nichts.
const lazyDefault = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/buchung/erfolg', element: <BookingSuccessPage /> },
  { path: '/ticket/:token', element: <TicketPage /> },
  { path: '/newsletter/bestaetigt', element: <NewsletterConfirmedPage /> },
  { path: '/impressum', element: <LegalPlaceholderPage title="Impressum" /> },
  { path: '/datenschutz', element: <LegalPlaceholderPage title="Datenschutz" /> },
  { path: '/agb', element: <LegalPlaceholderPage title="AGB" /> },
  { path: '/login/*', lazy: lazyDefault(() => import('./backoffice/LoginRoutes')) },
  { path: '/admin/*', lazy: lazyDefault(() => import('./backoffice/admin/AdminRoutes')) },
  { path: '/haendler/*', lazy: lazyDefault(() => import('./backoffice/haendler/HaendlerRoutes')) },
  { path: '*', element: <NotFoundPage /> },
];

// Vorschau (Artifact) läuft unter fremder URL – dort navigiert der Router nur im Speicher.
export const router = DEMO ? createMemoryRouter(routes) : createBrowserRouter(routes);
