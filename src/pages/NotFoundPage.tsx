import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold">Diese Seite gibt es nicht</h1>
      <Link to="/" className="text-gold underline underline-offset-4 hover:text-champagne">
        Zurück zur Startseite
      </Link>
    </main>
  );
}
