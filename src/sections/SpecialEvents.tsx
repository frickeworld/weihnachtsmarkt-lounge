import { useEffect, useState } from 'react';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import type { SlotAvailability } from '@/lib/availability';
import {
  fetchAvailability,
  fetchMarketProgram,
  fetchSpecialEvents,
  type ProgramItem,
  type SpecialEvent,
} from '@/lib/api';
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
 * Veranstaltungen stehen kompakt in einer Karte, jeder Termin ist ein eigener Knopf. Darunter das
 * Wochenend-Programm des Marktes mit den Lounge-Zeitfenstern des Abends. Erscheint nur, wenn es
 * Sonderveranstaltungen oder Programmpunkte gibt.
 */
export function SpecialEvents() {
  const settings = useSettings();
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [program, setProgram] = useState<ProgramItem[]>([]);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  useEffect(() => {
    let active = true;
    fetchSpecialEvents()
      .then((e) => active && setEvents(e))
      .catch(() => undefined);
    fetchMarketProgram()
      .then(async (p) => {
        if (!active || !p.length) return;
        setProgram(p);
        const a = await fetchAvailability(p[0]!.date, p.at(-1)!.date);
        if (active) setSlots(a);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!events.length && !program.length) return null;
  const groups = groupEvents(events);

  return (
    <section
      id="besondere-abende"
      className="on-dark scroll-mt-20 bg-brown px-4 py-20 text-on-dark sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <SectionHeading eyebrow="Programm" title="Partys und besondere Abende" dark>
          Partys mit STUDIO/F und der Tanzschule Fricke, Live-Musik am Wochenende – und du hast
          deine eigene Lounge mittendrin.
        </SectionHeading>
        <div className={`grid gap-5 ${groups.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {groups.map(({ key, first: e, days }) => {
            const all = days.flatMap((d) => d.slots);
            const soldOut = all.every((s) => s.status !== 'free');
            const someTaken = all.some((s) => s.status !== 'free');
            const singleDay = days.length === 1;
            return (
              <Reveal
                key={key}
                className="card relative flex flex-col overflow-hidden p-6 text-ink sm:p-7"
              >
                <div className="glitter absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="eyebrow">
                    {singleDay ? formatLongDate(days[0]!.date) : 'Sonderveranstaltung'}
                  </p>
                  {soldOut && (
                    <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
                      Ausgebucht
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-2xl leading-tight font-medium sm:text-3xl">{e.title}</h3>
                {e.act && <p className="mt-1 font-semibold text-gold-deep">{e.act}</p>}
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
                <ul
                  className={
                    singleDay
                      ? 'mt-2'
                      : 'mt-2 divide-y divide-line rounded-2xl border border-line bg-surface'
                  }
                >
                  {days.map((d) => (
                    <li
                      key={d.date}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${singleDay ? '' : 'p-3'}`}
                    >
                      {!singleDay && (
                        <span
                          className="w-[4.5rem] shrink-0 font-semibold"
                          title={formatLongDate(d.date)}
                        >
                          {shortDate(d.date)}
                        </span>
                      )}
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
        {program.length > 0 && <WeekendProgram program={program} slots={slots} />}
      </div>
    </section>
  );
}

/** Wochenend-Programm (Fr/Sa) mit den buchbaren Lounge-Zeitfenstern und Lounge-Preisen des Abends. */
function WeekendProgram({ program, slots }: { program: ProgramItem[]; slots: SlotAvailability[] }) {
  const settings = useSettings();
  const days = [...new Set(program.map((p) => p.date))];
  return (
    <div className="mt-16">
      <Reveal className="mx-auto mb-8 max-w-2xl text-center">
        <h3 className="text-3xl font-medium sm:text-4xl">Live am Wochenende</h3>
        <p className="mt-4 text-lg leading-relaxed text-on-dark/85">
          Freitags und samstags spielt auf der Winterbühne und auf Frickes Tanzfläche Live-Musik –
          deine Lounge ist mittendrin.
        </p>
      </Reveal>
      <div className="grid gap-5 md:grid-cols-2">
        {days.map((date) => {
          const acts = program.filter((p) => p.date === date);
          const evening = slots.filter(
            (s) => s.date === date && (s.status === 'free' || s.status === 'taken'),
          );
          return (
            <Reveal key={date} className="card relative flex flex-col p-6 text-ink sm:p-7">
              <div className="glitter absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
              <p className="eyebrow">{formatLongDate(date)}</p>
              <ul className="mt-3 space-y-3">
                {acts.map((a) => (
                  <li key={a.startTime + a.title}>
                    <p className="font-semibold">
                      <span className="tabular-nums text-gold-deep">
                        {a.startTime}
                        {a.endTime ? `–${a.endTime}` : ''} Uhr
                      </span>{' '}
                      · {a.title}
                    </p>
                    {(a.description || a.location) && (
                      <p className="text-sm text-ink-soft">
                        {[a.description, a.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {evening.length > 0 && (
                <>
                  <p className="mt-5 text-sm font-semibold">Deine Lounge an diesem Tag</p>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {evening.map((s) => {
                      const free = s.status === 'free';
                      const price =
                        s.totalCents === undefined
                          ? ''
                          : ` · ${euro(loungeCents(s.totalCents, settings))}`;
                      const when = `${formatLongDate(s.date)}, ${formatTime(s.startTime)} Uhr`;
                      return (
                        <a
                          key={s.startTime}
                          href="#buchen"
                          aria-label={
                            free ? `${when} buchen` : `${when} ausgebucht – auf die Warteliste`
                          }
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
                            'inline-flex min-h-11 items-center justify-center rounded-full border-2 px-3 text-sm font-semibold tabular-nums transition',
                            free
                              ? 'border-gold bg-gold/15 hover:bg-gold/35'
                              : 'border-line text-ink/50 line-through decoration-ink/40 hover:border-ink/30',
                          ].join(' ')}
                        >
                          {formatTime(s.startTime)}
                          {price}
                        </a>
                      );
                    })}
                  </span>
                  <p className="mt-2 text-xs text-ink-soft">
                    Lounge-Preise inkl. Freiverzehr, {feeNote(settings)}
                  </p>
                </>
              )}
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
