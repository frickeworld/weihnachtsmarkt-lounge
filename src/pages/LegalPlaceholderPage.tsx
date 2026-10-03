import { useEffect } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

/** Platzhalter für Impressum, Datenschutz und AGB. Die Entwürfe folgen in Phase 8. */
export function LegalPlaceholderPage({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} – Weihnachtsmarkt-Lounge der Händler`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <>
      <Header home={false} />
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="mb-6 text-5xl font-semibold">{title}</h1>
        <p className="text-cream/75">Der Inhalt dieser Seite folgt in Kürze.</p>
      </main>
      <Footer />
    </>
  );
}
