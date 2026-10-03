import { LazyMotion } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { DEMO } from './lib/demo';
import { SettingsProvider } from './lib/settingsContext';
import { router } from './router';
import './styles/index.css';

const loadMotionFeatures = () => import('./lib/motionFeatures').then((m) => m.default);

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <SettingsProvider>
        {DEMO && (
          <div className="bg-gold px-4 py-1.5 text-center text-xs font-semibold text-night">
            Vorschau mit Beispieldaten – Buchungen werden nicht gespeichert, es wird nichts bezahlt.
          </div>
        )}
        <RouterProvider router={router} />
      </SettingsProvider>
    </LazyMotion>
  </StrictMode>,
);
