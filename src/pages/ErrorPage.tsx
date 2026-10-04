import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { GlitterBand } from '@/components/GlitterBand';
import { WeihnachtsmarktLogo } from '@/components/WeihnachtsmarktLogo';
import { NotFoundPage } from './NotFoundPage';

/**
 * Fehlerseite für unerwartete Fehler. Typischer Fall nach einem Update: Ein altes Seitenteil
 * lässt sich nicht mehr laden – ein Neuladen hilft.
 */
export function ErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  const chunk =
    error instanceof Error &&
    /dynamically imported module|Importing a module script/i.test(error.message);
  return (
    <main className="flex min-h-dvh flex-col">
      <GlitterBand className="py-5">
        <div className="flex justify-center px-4">
          <WeihnachtsmarktLogo className="w-52" />
        </div>
      </GlitterBand>
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-20 text-center"
      >
        <p className="eyebrow">Hoppla</p>
        <h1 className="text-4xl font-medium sm:text-5xl">Da ist etwas schiefgelaufen</h1>
        <p className="max-w-md text-ink-soft">
          {chunk
            ? 'Die Seite wurde gerade aktualisiert. Bitte lade sie neu.'
            : 'Bitte lade die Seite neu. Wenn das Problem bleibt, schreib uns über das Kontaktformular.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-gold" onClick={() => window.location.reload()}>
            Seite neu laden
          </button>
          <Link to="/" className="btn-outline">
            Zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}
