import { Link } from 'react-router-dom';
import { GlitterBand } from '@/components/GlitterBand';
import { WeihnachtsmarktLogo } from '@/components/WeihnachtsmarktLogo';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <GlitterBand className="py-5">
        <div className="flex justify-center px-4">
          <WeihnachtsmarktLogo className="w-52" />
        </div>
      </GlitterBand>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-20 text-center">
        <p className="eyebrow">Fehler 404</p>
        <h1 className="text-4xl font-medium sm:text-5xl">Diese Seite gibt es nicht</h1>
        <Link to="/" className="btn-gold">
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
