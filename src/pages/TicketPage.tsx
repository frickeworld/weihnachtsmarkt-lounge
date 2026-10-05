import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HaendlerLogo } from '@/components/HaendlerLogo';
import { TicketDownloads } from '@/components/TicketDownloads';
import { fetchTicket, type TicketInfo } from '@/lib/api';
import { Countdown } from '@/components/Countdown';
import { formatLongDate } from '@/lib/dates';
import { useSettings } from '@/lib/settingsContext';
import { ticketDayNote } from '@/lib/specialDays';
import { useNoindex } from '@/lib/useNoindex';

const TOKEN = /^[A-Za-z0-9]{32}$/;

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; ticket: TicketInfo; qr: string }
  | { kind: 'notfound' }
  | { kind: 'error' };

const timeFmt = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

/** /ticket/[token] – für das Handy optimiert: großer QR-Code auf weißem Feld. */
export function TicketPage() {
  useNoindex();
  const { token = '' } = useParams();
  const valid = TOKEN.test(token);
  const [state, setState] = useState<State>(valid ? { kind: 'loading' } : { kind: 'notfound' });

  useEffect(() => {
    document.title = 'Dein Ticket – Weihnachtsmarkt-Lounge der Händler';
  }, []);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    Promise.all([fetchTicket(token), import('qrcode')])
      .then(async ([ticket, QR]) => {
        if (cancelled) return;
        if (!ticket) return setState({ kind: 'notfound' });
        // Inhalt nur der Ticket-Token – wie in der E-Mail.
        const qr = await QR.toDataURL(token, { errorCorrectionLevel: 'H', width: 600, margin: 2 });
        if (!cancelled) setState({ kind: 'ready', ticket, qr });
      })
      .catch(() => !cancelled && setState({ kind: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [token, valid]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-4 py-8 text-center">
      <Link to="/" aria-label="Zur Startseite">
        <HaendlerLogo size="md" plate />
      </Link>
      <p className="eyebrow mt-6">Weihnachtsmarkt-Lounge</p>

      {state.kind === 'loading' && (
        <p role="status" className="mt-16 text-ink-soft">
          Ticket wird geladen …
        </p>
      )}

      {state.kind === 'ready' && <TicketView ticket={state.ticket} qr={state.qr} token={token} />}

      {state.kind === 'notfound' && (
        <div role="alert" className="mt-12">
          <h1 className="text-3xl font-medium">Ticket nicht gefunden</h1>
          <p className="mt-4 text-ink-soft">
            Bitte öffne den Link aus deiner Ticket-Mail oder zeig am Einlass deinen Buchungscode.
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="mt-12">
          <h1 className="text-3xl font-medium">Keine Verbindung</h1>
          <p className="mt-4 text-ink-soft">
            Das Ticket konnte gerade nicht geladen werden. Den QR-Code findest du auch im PDF aus
            deiner Ticket-Mail.
          </p>
        </div>
      )}
    </main>
  );
}

function TicketView({ ticket, qr, token }: { ticket: TicketInfo; qr: string; token: string }) {
  const cancelled = ticket.status === 'cancelled';
  const { seasonStart, seasonEnd } = useSettings();
  const note = ticketDayNote(ticket.date, seasonStart, seasonEnd);
  const status = cancelled
    ? { label: 'Storniert', className: 'bg-rose-50 text-rose-800 ring-rose-300' }
    : ticket.checkedInAt
      ? {
          label: `Eingecheckt um ${timeFmt.format(new Date(ticket.checkedInAt))} Uhr`,
          className: 'bg-amber-50 text-amber-900 ring-amber-300',
        }
      : { label: 'Gültig', className: 'bg-emerald-50 text-emerald-800 ring-emerald-300' };

  return (
    <>
      <h1 className="mt-2 text-3xl leading-tight font-medium">{formatLongDate(ticket.date)}</h1>
      <p className="mt-1 text-xl">
        {ticket.startTime}–{ticket.endTime} Uhr
      </p>
      {note && <p className="mt-2 font-semibold text-gold-deep">{note}</p>}

      <span
        className={`mt-4 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${status.className}`}
      >
        {status.label}
      </span>

      {!cancelled && !ticket.checkedInAt && (
        <Countdown date={ticket.date} startTime={ticket.startTime} endTime={ticket.endTime} />
      )}

      <div
        className={`mt-6 w-full rounded-3xl border border-line bg-white p-5 shadow-[0_24px_50px_-36px_rgba(36,34,30,0.6)] ${cancelled ? 'opacity-30' : ''}`}
      >
        <img
          src={qr}
          alt={`QR-Code für Buchung ${ticket.bookingCode}`}
          className="mx-auto aspect-square w-full max-w-[320px]"
        />
      </div>

      <p className="mt-5 text-sm text-ink-soft">Buchungscode</p>
      <p className="font-mono text-2xl tracking-[0.15em]">{ticket.bookingCode}</p>

      <dl className="mt-6 w-full space-y-2 border-y border-line py-4 text-left">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Name</dt>
          <dd>{ticket.firstName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Personen</dt>
          <dd>{ticket.persons}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm leading-relaxed text-ink-soft">
        Zeig diesen QR-Code am Einlass. Bitte stell die Bildschirmhelligkeit hoch.
      </p>

      {!cancelled && <TicketDownloads token={token} />}
    </>
  );
}
