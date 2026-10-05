import { useEffect, useState } from 'react';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { fetchSpecialEvents, type SpecialEvent } from '@/lib/api';
import { formatLongDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { requestSlot } from '@/lib/selectSlot';
import { trackBookClick } from '@/lib/track';

const euro = (cents: number) => formatCents(cents).replace(/,00\s?€$/, ' €');

/**
 * „Besondere Abende“: Partys und Live-Auftritte mit eigenem Preis. Erscheint nur, wenn im Admin
 * Sonderveranstaltungen angelegt sind.
 */
export function SpecialEvents() {
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  useEffect(() => {
    let active = true;
    fetchSpecialEvents()
      .then((e) => active && setEvents(e))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!events.length) return null;

  return (
    <section id="besondere-abende" className="scroll-mt-20 bg-sand px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeading eyebrow="Sonderveranstaltungen" title="Besondere Abende">
          Partys und Live-Musik in der Lounge – mit mehr Freiverzehr und eigenem Programm.
        </SectionHeading>
        <div className="grid gap-5 sm:grid-cols-2">
          {events.map((e) => {
            const free = e.status === 'free';
            return (
              <Reveal
                key={`${e.date}-${e.startTime}`}
                className="card relative flex flex-col overflow-hidden p-6 sm:p-7"
              >
                <div className="glitter absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-haendler-red px-3 py-1 text-xs font-bold text-white">
                    {e.title}
                  </span>
                  {!free && (
                    <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
                      Ausgebucht
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-2xl font-medium">
                  {formatLongDate(e.date)}
                  <span className="block text-lg text-ink-soft">
                    {e.startTime}–{e.endTime} Uhr
                  </span>
                </h3>
                {e.act && <p className="mt-2 font-semibold text-gold-deep">{e.act}</p>}
                {e.description && (
                  <p className="mt-3 leading-relaxed text-ink-soft">{e.description}</p>
                )}
                <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-3xl font-medium">{euro(e.totalCents)}</span>
                  <span className="text-sm text-ink-soft">
                    inkl. {e.talerCount} € Freiverzehr und Vorverkaufsgebühr
                  </span>
                </p>
                <div className="mt-auto pt-6">
                  <a
                    href="#buchen"
                    onClick={(ev) => {
                      ev.preventDefault();
                      if (free) trackBookClick();
                      requestSlot(
                        free
                          ? { date: e.date, startTime: e.startTime }
                          : { date: e.date, waitlist: true },
                      );
                    }}
                    className={free ? 'btn-gold w-full' : 'btn-outline w-full'}
                  >
                    {free ? 'Lounge buchen' : 'Auf die Warteliste'}
                  </a>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
