import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LogoPlaque } from '@/components/LogoPlaque';
import { fetchTicket, type TicketInfo } from '@/lib/api';
import { formatLongDate } from '@/lib/dates';
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
        <LogoPlaque size="md" />
      </Link>
      <p className="eyebrow mt-6">Weihnachtsmarkt-Lounge</p>

      {state.kind === 'loading' && (
        <p role="status" className="mt-16 text-cream/80">
          Ticket wird geladen …
        </p>
      )}

      {state.kind === 'ready' && <TicketView ticket={state.ticket} qr={state.qr} />}

      {state.kind === 'notfound' && (
        <div role="alert" className="mt-12">
          <h1 className="text-3xl font-semibold">Ticket nicht gefunden</h1>
          <p className="mt-4 text-cream/80">
            Bitte öffne den Link aus deiner Ticket-Mail oder zeig am Einlass deinen Buchungscode.
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="mt-12">
          <h1 className="text-3xl font-semibold">Keine Verbindung</h1>
          <p className="mt-4 text-cream/80">
            Das Ticket konnte gerade nicht geladen werden. Den QR-Code findest du auch im PDF aus
            deiner Ticket-Mail.
          </p>
        </div>
      )}
    </main>
  );
}

function TicketView({ ticket, qr }: { ticket: TicketInfo; qr: string }) {
  const cancelled = ticket.status === 'cancelled';
  const status = cancelled
    ? { label: 'Storniert', className: 'bg-rose-500/15 text-rose-200 ring-rose-300/40' }
    : ticket.checkedInAt
      ? {
          label: `Eingecheckt um ${timeFmt.format(new Date(ticket.checkedInAt))} Uhr`,
          className: 'bg-amber-400/15 text-amber-100 ring-amber-300/40',
        }
      : { label: 'Gültig', className: 'bg-emerald-500/15 text-emerald-200 ring-emerald-300/40' };

  return (
    <>
      <h1 className="mt-2 text-3xl leading-tight font-semibold">{formatLongDate(ticket.date)}</h1>
      <p className="mt-1 text-xl">
        {ticket.startTime}–{ticket.endTime} Uhr
      </p>

      <span
        className={`mt-4 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${status.className}`}
      >
        {status.label}
      </span>

      <div className={`mt-6 w-full rounded-md bg-white p-5 ${cancelled ? 'opacity-30' : ''}`}>
        <img
          src={qr}
          alt={`QR-Code für Buchung ${ticket.bookingCode}`}
          className="mx-auto aspect-square w-full max-w-[320px]"
        />
      </div>

      <p className="mt-5 text-sm text-cream/70">Buchungscode</p>
      <p className="font-mono text-2xl tracking-[0.15em]">{ticket.bookingCode}</p>

      <dl className="mt-6 w-full space-y-2 border-y border-gold/20 py-4 text-left">
        <div className="flex justify-between">
          <dt className="text-cream/70">Name</dt>
          <dd>{ticket.firstName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-cream/70">Personen</dt>
          <dd>{ticket.persons}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm leading-relaxed text-cream/70">
        Zeig diesen QR-Code am Einlass. Bitte stell die Bildschirmhelligkeit hoch.
      </p>
    </>
  );
}
