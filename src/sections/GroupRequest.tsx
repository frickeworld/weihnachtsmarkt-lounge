import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { IconCheck } from '@/components/Icons';

const GroupRequestForm = lazy(() =>
  import('./GroupRequestForm').then((m) => ({ default: m.GroupRequestForm })),
);

/** „Firmen & Gruppen“: mehrere Zeitfenster oder Termine auf Anfrage, Angebot von STUDIO/F. */
export function GroupRequest() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="firmen" className="scroll-mt-20 bg-sand px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Firmen & Gruppen" title="Mehr als eine Lounge?">
          Für Weihnachtsfeiern, Kundenabende oder große Runden reservieren wir dir mehrere
          Zeitfenster – an einem Abend hintereinander oder an verschiedenen Tagen.
        </SectionHeading>
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <Reveal className="card p-7 sm:p-9">
            <h3 className="text-2xl font-medium">So läuft es</h3>
            <ul className="mt-5 space-y-3">
              {[
                'Du schickst uns Wunschtermine und Personenzahl.',
                'STUDIO/F prüft die freien Zeitfenster und schickt dir ein Angebot.',
                'Auf Wunsch mit Rechnung auf deine Firma.',
                'Freiverzehr und Tischservice wie bei jeder Lounge.',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <IconCheck className="mt-1 h-4 w-4 shrink-0 text-gold-deep" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <div ref={ref}>
            {visible ? (
              <Suspense fallback={<div className="card min-h-[34rem]" aria-busy="true" />}>
                <GroupRequestForm />
              </Suspense>
            ) : (
              <div className="card min-h-[34rem]" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
