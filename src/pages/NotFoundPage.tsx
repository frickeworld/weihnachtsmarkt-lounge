import { Link } from 'react-router-dom';
import { LightString } from '@/components/LightString';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 text-center">
      <LightString variant="hero" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-20">
        <p className="eyebrow">Fehler 404</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">Diese Seite gibt es nicht</h1>
        <Link to="/" className="btn-outline">
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
