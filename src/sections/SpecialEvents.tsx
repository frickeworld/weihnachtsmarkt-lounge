import { useEffect, useState } from 'react';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { fetchSpecialEvents, type SpecialEvent } from '@/lib/api';
import { formatLongDate, formatTime, isoWeekday, type IsoDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { requestSlot } from '@/lib/selectSlot';
import { feeNote, loungeCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { trackBookClick } from '@/lib/track';

const euro = (cents: number) => formatCents(cents).replace(/,00\s?€$/, ' €');
const WEEKDAY_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** „Di, 22.12.“ */
function shortDate(d: IsoDate): string {
  const [, m, day] = d.split('-');
  return `${WEEKDAY_SHORT[isoWeekday(d)]}, ${Number(day)}.${Number(m)}.`;
}

/** „2 Stunden“ bzw. „2,5 Stunden“ aus Beginn und Ende. */
function durationLabel(e: SpecialEvent): string {
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const h = (min(e.endTime) - min(e.startTime)) / 60;
  return `${h.toLocaleString('de-DE')} ${h === 1 ? 'Stunde' : 'Stunden'}`;
}

interface EventGroup {
  key: string;
  first: SpecialEvent;
  days: { date: IsoDate; slots: SpecialEvent[] }[];
}

/** Gleiche Veranstaltung (Titel, Preis, Text) an mehreren Terminen → eine Karte. */
function groupEvents(events: SpecialEvent[]): EventGroup[] {
  const groups = new Map<string, EventGroup>();
  for (const e of events) {
    const key = [e.title, e.act, e.description, e.totalCents, e.talerCount].join('|');
    let g = groups.get(key);
    if (!g) {
      g = { key, first: e, days: [] };
      groups.set(key, g);
    }
    let day = g.days.find((d) => d.date === e.date);
    if (!day) {
      day = { date: e.date, slots: [] };
      g.days.push(day);
    }
    day.slots.push(e);
  }
  for (const g of groups.values()) {
    g.days.sort((a, b) => a.date.localeCompare(b.date));
    g.days.forEach((d) => d.slots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  }
  return [...groups.values()];
}

/**
 * „Besondere Termine“: Party-Abende, Feiertage und Live-Auftritte mit eigenem Preis. Gleiche
 * Veranstaltungen stehen kompakt in einer Karte, jeder Termin ist ein eigener Knopf. Erscheint nur,
 * wenn im Admin Sonderveranstaltungen angelegt sind.
 */
export function SpecialEvents() {
  const settings = useSettings();
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
  const groups = groupEvents(events);

  return (
    <section id="besondere-abende" className="scroll-mt-20 bg-sand px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeading eyebrow="Sonderveranstaltungen" title="Besondere Termine">
          Party-Abende, Feiertage und besondere Anlässe – mit eigenem Preis und mehr Freiverzehr.
        </SectionHeading>
        <div className={`grid gap-5 ${groups.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {groups.map(({ key, first: e, days }) => {
            const all = days.flatMap((d) => d.slots);
            const soldOut = all.every((s) => s.status !== 'free');
            const someTaken = all.some((s) => s.status !== 'free');
            return (
              <Reveal key={key} className="card relative flex flex-col overflow-hidden p-6 sm:p-7">
                <div className="glitter absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="rounded-full bg-haendler-red px-3 py-1 text-sm font-bold text-white">
                    {e.title}
                  </h3>
                  {soldOut && (
                    <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
                      Ausgebucht
                    </span>
                  )}
                </div>
                {e.act && <p className="mt-3 font-semibold text-gold-deep">{e.act}</p>}
                {e.description && (
                  <p className="mt-3 leading-relaxed text-ink-soft">{e.description}</p>
                )}
                <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-3xl font-medium">
                    {euro(loungeCents(e.totalCents, settings))}
                  </span>
                  <span className="text-sm text-ink-soft">
                    inkl. {e.talerCount} € Freiverzehr, {feeNote(settings)}
                  </span>
                </p>
                <p className="mt-5 text-sm font-semibold">
                  {all.length === 1
                    ? `Termin: ${formatTime(e.startTime)}–${formatTime(e.endTime)} Uhr`
                    : `Beginn wählen (je ${durationLabel(e)})`}
                </p>
                <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
                  {days.map((d) => (
                    <li key={d.date} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                      <span
                        className="w-[4.5rem] shrink-0 font-semibold"
                        title={formatLongDate(d.date)}
                      >
                        {shortDate(d.date)}
                      </span>
                      <span className="flex flex-1 flex-wrap gap-2">
                        {d.slots.map((s) => {
                          const free = s.status === 'free';
                          const when = `${formatLongDate(s.date)}, ${formatTime(s.startTime)} Uhr`;
                          return (
                            <a
                              key={s.startTime}
                              href="#buchen"
                              aria-label={
                                free ? `${when} buchen` : `${when} ausgebucht – auf die Warteliste`
                              }
                              title={`${formatTime(s.startTime)}–${formatTime(s.endTime)} Uhr`}
                              onClick={(ev) => {
                                ev.preventDefault();
                                if (free) trackBookClick();
                                requestSlot(
                                  free
                                    ? { date: s.date, startTime: s.startTime }
                                    : { date: s.date, waitlist: true },
                                );
                              }}
                              className={[
                                'inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-full border-2 px-3 text-sm font-semibold tabular-nums transition',
                                free
                                  ? 'border-gold bg-gold/15 hover:bg-gold/35'
                                  : 'border-line text-ink/50 line-through decoration-ink/40 hover:border-ink/30',
                              ].join(' ')}
                            >
                              {formatTime(s.startTime)}
                            </a>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {someTaken && (
                  <p className="mt-3 text-xs text-ink-soft">
                    Durchgestrichene Zeiten sind schon vergeben – ein Tipp darauf setzt dich auf die
                    Warteliste.
                  </p>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
