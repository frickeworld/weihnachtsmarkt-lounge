import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { SectionHeading } from '@/components/SectionHeading';
import { Reveal } from '@/components/Reveal';
import { groupByDate } from '@/lib/availability';
import { addDays, formatLongDate, parseIsoDate, todayInBerlin, type IsoDate } from '@/lib/dates';
import { useSettings } from '@/lib/settingsContext';
import { sampleAvailability } from '@/lib/slots';
import { usePrefersReducedMotion } from '@/lib/useMediaQuery';
import { Calendar } from './booking/Calendar';
import { SlotPicker } from './booking/SlotPicker';

// Formular (zod, react-hook-form) erst laden, wenn ein Zeitfenster gewählt ist.
const BookingForm = lazy(() =>
  import('./booking/BookingForm').then((m) => ({ default: m.BookingForm })),
);

type YM = { year: number; month: number };
const ym = (d: IsoDate): YM => ({
  year: parseIsoDate(d).getUTCFullYear(),
  month: parseIsoDate(d).getUTCMonth() + 1,
});
const ymKey = (v: YM) => v.year * 12 + v.month;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 sm:p-8">
      <h3 className="mb-6 flex items-center gap-3 text-2xl font-semibold sm:text-3xl">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold font-sans text-base text-champagne">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function Booking() {
  const settings = useSettings();
  const reduced = usePrefersReducedMotion();
  const today = todayInBerlin();

  const first = settings.seasonStart > today ? settings.seasonStart : today;
  const minMonth = ym(first);
  const maxMonth = ym(settings.seasonEnd);
  const [view, setView] = useState<YM>(minMonth);
  const [date, setDate] = useState<IsoDate | null>(null);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Phase 1: Beispieldaten. Ab Phase 2 aus get_availability().
  const byDate = useMemo(() => {
    const from = `${view.year}-${String(view.month).padStart(2, '0')}-01`;
    const to = addDays(
      `${view.month === 12 ? view.year + 1 : view.year}-${String((view.month % 12) + 1).padStart(2, '0')}-01`,
      -1,
    );
    return groupByDate(
      sampleAvailability(from, to, { start: settings.seasonStart, end: settings.seasonEnd }, today),
    );
  }, [view, settings.seasonStart, settings.seasonEnd, today]);

  const daySlots = date ? (byDate.get(date) ?? []) : [];
  const slot = daySlots.find((s) => s.startTime === slotStart && s.status === 'free') ?? null;

  const scrollTo = (el: HTMLElement | null) =>
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

  useEffect(() => {
    if (date) scrollTo(slotsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
  useEffect(() => {
    if (slotStart) scrollTo(formRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotStart]);

  const move = (delta: number) => {
    const k = ymKey(view) + delta;
    const year = Math.floor((k - 1) / 12);
    setView({ year, month: k - year * 12 });
  };

  return (
    <section id="buchen" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Buchung" title="Wähle deinen Abend" />
        <Reveal className="space-y-6">
          <Step n={1} title="Tag wählen">
            <Calendar
              year={view.year}
              month={view.month}
              canPrev={ymKey(view) > ymKey(minMonth)}
              canNext={ymKey(view) < ymKey(maxMonth)}
              onPrev={() => move(-1)}
              onNext={() => move(1)}
              byDate={byDate}
              selected={date}
              onSelect={(d) => {
                setDate(d);
                setSlotStart(null);
              }}
            />
          </Step>

          {date && (
            <div ref={slotsRef} className="scroll-mt-20">
              <Step n={2} title="Zeitfenster wählen">
                <p className="mb-4 text-cream/75">{formatLongDate(date)}</p>
                <SlotPicker slots={daySlots} selected={slotStart} onSelect={setSlotStart} />
              </Step>
            </div>
          )}

          {date && slot && (
            <div ref={formRef} className="scroll-mt-20">
              <Step n={3} title="Deine Angaben">
                <Suspense fallback={<p className="text-cream/70">Formular wird geladen …</p>}>
                  <BookingForm date={date} startTime={slot.startTime} endTime={slot.endTime} />
                </Suspense>
              </Step>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
