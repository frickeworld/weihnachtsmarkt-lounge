import { LogoPlaque } from '@/components/LogoPlaque';
import { StudioFBadge } from '@/components/StudioFBadge';

/** Phase 0: Platzhalter im Seitendesign. Der One-Pager folgt in Phase 1. */
export function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <p className="text-xs font-semibold tracking-[0.25em] text-champagne uppercase">
        Weihnachtsmarkt im Schlosspark Detmold
      </p>
      <LogoPlaque size="lg" />
      <div className="h-px w-24 bg-gold" aria-hidden="true" />
      <h1 className="max-w-xl text-4xl leading-tight font-semibold sm:text-5xl">
        Deine Lounge mitten im Weihnachtsmarkt
      </h1>
      <p className="max-w-md text-cream/80">
        Hier entsteht gerade etwas Festliches. Bald kannst du deine Lounge buchen.
      </p>
      <footer className="mt-10">
        <StudioFBadge />
      </footer>
    </main>
  );
}
