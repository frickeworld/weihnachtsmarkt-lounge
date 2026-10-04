import { useEffect, type ReactNode } from 'react';
import { Footer } from '@/components/Footer';
import { GlitterBand } from '@/components/GlitterBand';
import { Header } from '@/components/Header';
import { LEGAL_SHORT } from '../../../supabase/functions/_shared/legal.ts';

/** Rahmen für Impressum, Datenschutz und AGB – mit deutlichem Entwurfs-Vermerk. */
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} – Weihnachtsmarkt-Lounge der Händler`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <>
      <Header home={false} />
      <GlitterBand className="h-3" stars={false} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div
          role="note"
          className="mb-8 rounded-2xl border-2 border-haendler-red/60 bg-red-50 p-4 text-red-950"
        >
          <strong>Entwurf – noch nicht freigegeben.</strong> Dieser Text wird vor dem Start
          rechtlich geprüft. Angaben in eckigen Klammern werden noch ergänzt.
        </div>
        <h1 className="mb-2 text-4xl font-medium sm:text-5xl">{title}</h1>
        <p className="mb-10 text-sm text-ink-soft">Stand: {LEGAL_SHORT.draftDate}</p>
        <div className="legal space-y-4 leading-relaxed text-ink">{children}</div>
      </main>
      <Footer />
    </>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-6 text-2xl font-medium">{children}</h2>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-lg font-semibold">{children}</h3>;
}
