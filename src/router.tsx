import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LegalPlaceholderPage } from './pages/LegalPlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Weitere Routen (/buchung/erfolg, /ticket/:token, /login, /admin, /haendler, /scan)
// kommen in den jeweiligen Phasen dazu.
export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/impressum', element: <LegalPlaceholderPage title="Impressum" /> },
  { path: '/datenschutz', element: <LegalPlaceholderPage title="Datenschutz" /> },
  { path: '/agb', element: <LegalPlaceholderPage title="AGB" /> },
  { path: '*', element: <NotFoundPage /> },
]);
