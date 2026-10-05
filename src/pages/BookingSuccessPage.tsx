import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { GlitterBand } from '@/components/GlitterBand';
import { Countdown } from '@/components/Countdown';
import { TalerRain } from '@/components/TalerRain';
import { TicketDownloads } from '@/components/TicketDownloads';
import taler192 from '@/assets/taler-192.webp';
import { fetchSuccessInfo, fetchSuccessTicketToken, type SuccessInfo } from '@/lib/api';
import { formatLongDate } from '@/lib/dates';
import { ticketDayNote } from '@/lib/specialDays';
import { useSettings } from '@/lib/settingsContext';
import { useNoindex } from '@/lib/useNoindex';
import { DEMO } from '@/lib/demo';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20000;

type View =
  | { kind: 'loading' }
  | { kind: 'paid'; info: SuccessInfo; token: string | null }
  | { kind: 'confirming'; info: SuccessInfo | null }
  | { kind: 'conflict'; info: SuccessInfo }
  | { kind: 'unknown' };

/**
 * /buchung/erfolg?session_id=cs_…
 * Fragt bis zu 20 Sekunden alle 2 Sekunden nach, falls der Stripe-Webhook noch nicht angekommen ist.
 */
export function BookingSuccessPage() {
  useNoindex();
  const { contactEmail, seasonStart, seasonEnd } = useSettings();
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') ?? '';
  const validSession = sessionId.startsWith('cs_');
  const [view, setView] = useState<View>(validSession ? { kind: 'loading' } : { kind: 'unknown' });
  // Taler-Regen: startet bei bestätigter Zahlung; ein Tipp auf den Taler lässt es noch einmal regnen.
  const [rain, setRain] = useState(0);

  useEffect(() => {
    document.title = 'Buchung bestätigt – Weihnachtsmarkt-Lounge der Händler';
  }, []);

  useEffect(() => {
    if (!validSession) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();

    const poll = async () => {
      const info = await fetchSuccessInfo(sessionId).catch(() => null);
      if (cancelled) return;
      if (info?.status === 'paid') {
        const token = await fetchSuccessTicketToken(sessionId).catch(() => null);
        if (!cancelled) {
          setView({ kind: 'paid', info, token });
          setRain((n) => n + 1);
        }
        return;
      }
      if (info?.status === 'cancelled') return setView({ kind: 'conflict', info });
      if (Date.now() - started >= POLL_TIMEOUT_MS) {
        return setView(
          info || sessionId.startsWith('cs_') ? { kind: 'confirming', info } : { kind: 'unknown' },
        );
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, validSession]);

  return (
    <>
      <Header home={false} />
      <GlitterBand className="h-3" />
      <TalerRain play={rain} />
      <main className="relative min-h-[70vh] px-4 pt-6 pb-20 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          {view.kind === 'loading' && (
            <p role="status" className="mt-16 text-lg text-ink-soft">
              Einen Moment, wir bestätigen deine Buchung …
            </p>
          )}

          {view.kind === 'paid' && (
            <div className="mt-10" role="status">
              <button
                type="button"
                onClick={() => setRain((n) => n + 1)}
                className="mx-auto mb-5 block rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep motion-safe:animate-[taler-pop_900ms_ease-out]"
                aria-label="Weihnachtsmarkt-Taler – noch einmal Taler regnen lassen"
              >
                <img
                  src={taler192}
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 drop-shadow-lg"
                />
              </button>
              <p className="eyebrow mb-4">Buchung bestätigt</p>
              <h1 className="text-4xl leading-tight font-medium sm:text-5xl">
                Danke, {view.info.firstName}! Deine Lounge ist gebucht.
              </h1>
              <div className="card mx-auto mt-10 max-w-md p-7">
                <p className="font-display text-3xl font-medium">
                  {formatLongDate(view.info.date)}
                </p>
                <p className="mt-1 text-xl">
                  {view.info.startTime}–{view.info.endTime} Uhr
                </p>
                {ticketDayNote(view.info.date, seasonStart, seasonEnd) && (
                  <p className="mt-2 font-semibold text-gold-deep">
                    {ticketDayNote(view.info.date, seasonStart, seasonEnd)}
                  </p>
                )}
                <div className="mx-auto my-5 h-1 w-12 rounded-full bg-gold" aria-hidden="true" />
                <p className="text-sm text-ink-soft">Buchungscode</p>
                <p className="mt-1 font-mono text-lg tracking-wider">{view.info.bookingCode}</p>
              </div>
              <div className="mx-auto max-w-md">
                <Countdown
                  date={view.info.date}
                  startTime={view.info.startTime}
                  endTime={view.info.endTime}
                />
              </div>
              <p className="mt-8 text-lg text-ink">Dein Ticket ist auf dem Weg in dein Postfach.</p>
              {view.token && (
                <div className="mx-auto max-w-md">
                  <Link to={`/ticket/${view.token}`} className="btn-gold mt-6 w-full">
                    {DEMO ? 'Vorschau: Online-Ticket ansehen' : 'Ticket jetzt öffnen'}
                  </Link>
                  <TicketDownloads
                    token={view.token}
                    slot={{
                      date: view.info.date,
                      startTime: view.info.startTime,
                      endTime: view.info.endTime,
                      bookingCode: view.info.bookingCode,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {view.kind === 'confirming' && (
            <div className="mt-10" role="status">
              <h1 className="text-4xl leading-tight font-medium">Fast geschafft</h1>
              <p className="mt-6 text-lg text-ink">
                Deine Zahlung wird bestätigt – du bekommst gleich eine E-Mail.
              </p>
              {view.info && (
                <p className="mt-4 text-ink-soft">
                  {formatLongDate(view.info.date)}, {view.info.startTime}–{view.info.endTime} Uhr
                </p>
              )}
            </div>
          )}

          {view.kind === 'conflict' && (
            <div className="mt-10" role="alert">
              <h1 className="text-4xl leading-tight font-medium">Das tut uns leid</h1>
              <p className="mt-6 text-lg text-ink">
                Deine Zahlung kam erst an, nachdem die Reservierung abgelaufen war – und das
                Zeitfenster wurde inzwischen vergeben. Wir erstatten dir den vollen Betrag.
              </p>
              <p className="mt-4 text-ink-soft">
                Bei Fragen erreichst du uns unter{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-semibold text-gold-deep underline underline-offset-4"
                >
                  {contactEmail}
                </a>{' '}
                (Buchungscode {view.info.bookingCode}).
              </p>
            </div>
          )}

          {view.kind === 'unknown' && (
            <div className="mt-10" role="alert">
              <h1 className="text-4xl leading-tight font-medium">Buchung nicht gefunden</h1>
              <p className="mt-6 text-lg text-ink">
                Wir konnten diese Buchung gerade nicht finden. Falls du bezahlt hast, kommt dein
                Ticket per E-Mail. Bei Fragen erreichst du uns unter{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-semibold text-gold-deep underline underline-offset-4"
                >
                  {contactEmail}
                </a>
                .
              </p>
            </div>
          )}

          <Link to="/" className="btn-outline mt-12">
            Zurück zur Startseite
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
