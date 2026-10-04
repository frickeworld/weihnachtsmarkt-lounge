import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import studioFLogo from '@/assets/studiof-logo.svg';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { useSettings } from '@/lib/settingsContext';

const ContactForm = lazy(() => import('./ContactForm').then((m) => ({ default: m.ContactForm })));

/** „Fragen? STUDIO/F hilft dir“ – Kontaktformular, landet im Postfach von STUDIO/F. */
export function Contact() {
  const { contactEmail } = useSettings();
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
    <section id="kontakt" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Kontakt" title="Fragen? Wir helfen dir gern.">
          Ob zur Buchung, zur Zahlung oder wenn dein Ticket nicht angekommen ist: Schreib uns
          einfach.
        </SectionHeading>

        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <Reveal className="on-dark flex flex-col rounded-3xl bg-brown p-7 text-on-dark sm:p-9">
            <img src={studioFLogo} alt="STUDIO/F" className="h-20 w-auto self-start sm:h-24" />
            <h3 className="mt-8 text-2xl font-medium">STUDIO/F ist dein Ansprechpartner</h3>
            <p className="mt-3 leading-relaxed text-on-dark/85">
              STUDIO/F betreut die Lounge-Buchung für die Händler und kümmert sich persönlich um
              dein Anliegen – von der Frage vor der Buchung bis zum Ticket, das nicht im Postfach
              gelandet ist.
            </p>
            <ul className="mt-6 space-y-2 text-on-dark/85">
              <li>
                <span className="text-gold-light">E-Mail:</span>{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-semibold underline underline-offset-4"
                >
                  {contactEmail}
                </a>
              </li>
              <li>
                <span className="text-gold-light">Tipp:</span> Mit Buchungscode (HL-XXXX-XXXX) geht
                es am schnellsten.
              </li>
            </ul>
            <a
              href="https://www.studio-f.club"
              target="_blank"
              rel="noopener"
              className="btn-outline mt-auto self-start !mt-8"
            >
              Mehr über STUDIO/F
            </a>
          </Reveal>

          <div ref={ref}>
            {visible ? (
              <Suspense fallback={<div className="card min-h-[30rem]" aria-busy="true" />}>
                <ContactForm />
              </Suspense>
            ) : (
              <div className="card min-h-[30rem]" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
