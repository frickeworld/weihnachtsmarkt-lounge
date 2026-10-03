import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

// Weitere Routen (/buchung/erfolg, /ticket/:token, /login, /admin, /haendler, /scan, Rechtsseiten)
// kommen in den jeweiligen Phasen dazu.
export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '*', element: <NotFoundPage /> },
]);
