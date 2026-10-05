import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/Reveal';
import { releaseHold } from '@/lib/api';
import { SectionHeading } from '@/components/SectionHeading';
import { addDays, formatLongDate, parseIsoDate, todayInBerlin, type IsoDate } from '@/lib/dates';
import { useSettings } from '@/lib/settingsContext';
import { useAvailability } from '@/lib/useAvailability';
import { usePrefersReducedMotion } from '@/lib/useMediaQuery';
import { Calendar } from './booking/Calendar';
import { SlotPicker } from './booking/SlotPicker';
import { Waitlist } from './booking/Waitlist';

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
const clampView = (v: YM, min: YM, max: YM): YM =>
  ymKey(v) < ymKey(min) ? min : ymKey(v) > ymKey(max) ? max : v;
const monthStart = (v: YM): IsoDate => `${v.year}-${String(v.month).padStart(2, '0')}-01`;
const monthEnd = (v: YM): IsoDate =>
  addDays(
    monthStart(
      v.month === 12 ? { year: v.year + 1, month: 1 } : { year: v.year, month: v.month + 1 },
    ),
    -1,
  );

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 shadow-[0_24px_50px_-40px_rgba(36,34,30,0.6)] sm:p-8">
      <h3 className="mb-6 flex items-center gap-3 text-2xl font-medium sm:text-3xl">
        <span className="glitter flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans text-base font-bold">
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
  // Link aus der Warteliste-Mail: /?datum=YYYY-MM-DD#buchen öffnet direkt diesen Tag.
  const [linkedDate] = useState<IsoDate | null>(() => {
    const d = new URLSearchParams(window.location.search).get('datum');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today ? d : null;
  });
  const [requestedView, setView] = useState<YM | null>(() => (linkedDate ? ym(linkedDate) : null));
  // Ansicht immer im Saisonzeitraum halten (auch wenn die echten Einstellungen erst später kommen).
  const view = clampView(requestedView ?? minMonth, minMonth, maxMonth);
  const [date, setDate] = useState<IsoDate | null>(linkedDate);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  // Rückkehr von Stripe mit „Zurück“: /?abbruch=<booking_id>#buchen
  const [abortedBookingId] = useState(() =>
    new URLSearchParams(window.location.search).get('abbruch'),
  );
  const [notice, setNotice] = useState<string | null>(() =>
    abortedBookingId ? 'Zahlung abgebrochen. Du kannst es gleich noch einmal versuchen.' : null,
  );
  const [holdReleased, setHoldReleased] = useState(!abortedBookingId);
  const [open, setOpen] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Verfügbarkeit erst laden, wenn der Buchungsbereich in die Nähe kommt.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e!.isIntersecting) {
          setOpen(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Reservierung sofort freigeben und den Parameter aus der Adresse entfernen.
  useEffect(() => {
    if (!abortedBookingId) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('abbruch');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    void releaseHold(abortedBookingId).then(() => setHoldReleased(true));
  }, [abortedBookingId]);

  // Verfügbarkeit erst laden, wenn eine abgebrochene Reservierung freigegeben ist.
  const { byDate, state, reload } = useAvailability(
    monthStart(view),
    monthEnd(view),
    open && holdReleased,
  );

  const daySlots = date ? (byDate.get(date) ?? []) : [];
  // Ausgebuchte Tage im angezeigten Monat (für die Warteliste)
  const bookedDays = [...byDate.entries()]
    .filter(
      ([d, slots]) =>
        d >= today &&
        slots.some((x) => x.status === 'taken') &&
        !slots.some((x) => x.status === 'free'),
    )
    .map(([d]) => d)
    .sort();
  const slot = daySlots.find((s) => s.startTime === slotStart && s.status === 'free') ?? null;

  const scrollTo = (el: HTMLElement | null) =>
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

  /** Nach jeder Auswahl frisch laden und prüfen, ob die Auswahl noch frei ist. */
  async function refreshAndCheck(nextDate: IsoDate, nextSlot: string | null) {
    const map = await reload();
    if (!map) return;
    const slots = map.get(nextDate) ?? [];
    if (!slots.some((s) => s.status === 'free')) {
      setDate(null);
      setSlotStart(null);
      setNotice('Dieser Tag ist gerade ausgebucht. Bitte wähle einen anderen.');
    } else if (nextSlot && !slots.some((s) => s.startTime === nextSlot && s.status === 'free')) {
      setSlotStart(null);
      setNotice('Dieser Termin wurde gerade gebucht. Bitte wähle einen anderen.');
    }
  }

  function selectDate(d: IsoDate) {
    setNotice(null);
    setDate(d);
    setSlotStart(null);
    requestAnimationFrame(() => scrollTo(slotsRef.current));
    void refreshAndCheck(d, null);
  }

  function selectSlot(start: string) {
    if (!date) return;
    setNotice(null);
    setSlotStart(start);
    requestAnimationFrame(() => scrollTo(formRef.current));
    void refreshAndCheck(date, start);
  }

  const move = (delta: number) => {
    const k = ymKey(view) + delta;
    const year = Math.floor((k - 1) / 12);
    setView({ year, month: k - year * 12 });
  };

  return (
    <section ref={sectionRef} id="buchen" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Buchung" title="Wähle deinen Abend" />
        <Reveal className="space-y-6">
          <Step n={1} title="Tag wählen">
            <div className="relative" aria-busy={state === 'loading'}>
              <Calendar
                year={view.year}
                month={view.month}
                canPrev={ymKey(view) > ymKey(minMonth)}
                canNext={ymKey(view) < ymKey(maxMonth)}
                onPrev={() => move(-1)}
                onNext={() => move(1)}
                byDate={byDate}
                selected={date}
                onSelect={selectDate}
              />
              {state === 'loading' && (
                <p className="mt-4 text-sm text-ink-soft" role="status">
                  Verfügbarkeit wird geladen …
                </p>
              )}
              {(state === 'error' || state === 'unconfigured') && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
                >
                  <p>
                    Die freien Termine können gerade nicht geladen werden. Bitte prüfe deine
                    Verbindung und versuche es noch einmal.
                  </p>
                  {state === 'error' && (
                    <button
                      type="button"
                      onClick={() => void reload()}
                      className="btn-outline mt-3 !min-h-10"
                    >
                      Erneut versuchen
                    </button>
                  )}
                </div>
              )}
            </div>
            {state === 'ready' && (
              <Waitlist
                key={monthStart(view)}
                bookedDays={bookedDays}
                onFreeNow={(d) => {
                  selectDate(d);
                  setNotice('Gute Nachricht: An diesem Tag ist gerade wieder etwas frei.');
                }}
              />
            )}
            {notice && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-gold bg-gold/15 p-4 font-medium"
              >
                {notice}
              </p>
            )}
          </Step>

          {date && (
            <div ref={slotsRef} className="scroll-mt-20">
              <Step n={2} title="Zeitfenster wählen">
                <p className="mb-4 text-ink-soft">{formatLongDate(date)}</p>
                <SlotPicker slots={daySlots} selected={slotStart} onSelect={selectSlot} />
              </Step>
            </div>
          )}

          {date && slot && (
            <div ref={formRef} className="scroll-mt-20">
              <Step n={3} title="Deine Angaben">
                <Suspense fallback={<p className="text-ink-soft">Formular wird geladen …</p>}>
                  <BookingForm
                    date={date}
                    startTime={slot.startTime}
                    endTime={slot.endTime}
                    totalCents={slot.totalCents}
                    talerCount={slot.talerCount}
                    specialTitle={slot.specialTitle}
                    onSlotUnavailable={(message) => {
                      setSlotStart(null);
                      setNotice(message);
                      void reload();
                      requestAnimationFrame(() => scrollTo(slotsRef.current));
                    }}
                  />
                </Suspense>
              </Step>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
