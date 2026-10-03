import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { DEMO } from './lib/demo';
import { BookingSuccessPage } from './pages/BookingSuccessPage';
import { HomePage } from './pages/HomePage';
import { LegalPlaceholderPage } from './pages/LegalPlaceholderPage';
import { NewsletterConfirmedPage } from './pages/NewsletterConfirmedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TicketPage } from './pages/TicketPage';

// Weitere Routen (/login, /admin, /haendler, /scan)
// kommen in den jeweiligen Phasen dazu.
const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/buchung/erfolg', element: <BookingSuccessPage /> },
  { path: '/ticket/:token', element: <TicketPage /> },
  { path: '/newsletter/bestaetigt', element: <NewsletterConfirmedPage /> },
  { path: '/impressum', element: <LegalPlaceholderPage title="Impressum" /> },
  { path: '/datenschutz', element: <LegalPlaceholderPage title="Datenschutz" /> },
  { path: '/agb', element: <LegalPlaceholderPage title="AGB" /> },
  { path: '*', element: <NotFoundPage /> },
];

// Vorschau (Artifact) läuft unter fremder URL – dort navigiert der Router nur im Speicher.
export const router = DEMO ? createMemoryRouter(routes) : createBrowserRouter(routes);
