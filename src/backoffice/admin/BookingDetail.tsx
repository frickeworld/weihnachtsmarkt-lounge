import { useState } from 'react';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Dialog, ErrorBox, SuccessBox, dangerBtn, smallBtn } from '../ui';
import { callAdmin } from './api';
import { formatDateTime, formatDay, hhmm } from './format';
import {
  OCCASION_LABEL,
  PAYMENT_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  type Booking,
  type EmailLogRow,
} from './types';
import { unwrap, useLoad } from './useLoad';

const EMAIL_TYPE: Record<string, string> = {
  ticket: 'Ticket',
  reminder: 'Erinnerung',
  doi: 'Newsletter-Bestätigung',
  contact: 'Kontaktliste',
};

export function StatusBadge({ status }: { status: Booking['status'] }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function BookingDetail({
  booking: b,
  onClose,
  onChanged,
}: {
  booking: Booking;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const log = useLoad(
    async () =>
      unwrap(
        await requireClient()
          .from('email_log')
          .select('id, type, status, error, created_at')
          .eq('booking_id', b.id)
          .order('created_at', { ascending: false }),
      ) as EmailLogRow[],
    [b.id, msg],
  );

  const run = async (label: string, fn: () => Promise<string | null>) => {
    setBusy(true);
    setMsg(null);
    try {
      const err = await fn();
      setMsg(err ? { ok: false, text: err } : { ok: true, text: label });
      if (!err) onChanged();
    } finally {
      setBusy(false);
    }
  };
  const rpc = (name: string, args: Record<string, unknown>) => async () => {
    const { error } = await requireClient().rpc(name, args);
    return error ? errorText(error) : null;
  };

  const paid = b.status === 'paid';
  const rows: [string, React.ReactNode][] = [
    ['Buchungscode', <span className="font-mono">{b.booking_code}</span>],
    ['Termin', `${formatDay(b.date)}, ${hhmm(b.start_time)}–${hhmm(b.end_time)} Uhr`],
    ['Status', <StatusBadge status={b.status} />],
    ['Name', `${b.first_name} ${b.last_name}`],
    [
      'E-Mail',
      b.email ? (
        <a href={`mailto:${b.email}`} className="underline">
          {b.email}
        </a>
      ) : (
        '–'
      ),
    ],
    [
      'Telefon',
      b.phone ? (
        <a href={`tel:${b.phone}`} className="underline">
          {b.phone}
        </a>
      ) : (
        '–'
      ),
    ],
    ['Personen', b.persons],
    ['Anlass', b.occasion ? (OCCASION_LABEL[b.occasion] ?? b.occasion) : '–'],
    ['Firma', b.company_name || '–'],
    ['USt-ID', b.vat_id || '–'],
    [
      'Rechnungsadresse',
      b.billing_street ? `${b.billing_street}, ${b.billing_zip} ${b.billing_city}` : '–',
    ],
    ['Wünsche', b.notes || '–'],
    ['Newsletter', b.newsletter_opt_in ? 'Ja (Double-Opt-in)' : 'Nein'],
    [
      'Zahlungsart',
      `${PAYMENT_LABEL[b.payment_method]}${b.source === 'manual' ? ' · manuell angelegt' : ''}`,
    ],
    [
      'Betrag',
      `${formatCents(b.amount_total_cents)} (Lounge ${formatCents(b.price_cents)} + Gebühr ${formatCents(b.fee_cents)})`,
    ],
    [
      'Händler-Anteil',
      b.include_in_settlement ? formatCents(b.haendler_share_cents) : 'nicht in der Abrechnung',
    ],
    ['Bezahlt am', formatDateTime(b.paid_at)],
    ['Eingecheckt', formatDateTime(b.checked_in_at)],
    ['Taler übergeben', formatDateTime(b.taler_handed_out_at)],
    ['Erinnerung', formatDateTime(b.reminder_sent_at)],
  ];
  if (b.stripe_invoice_url)
    rows.push([
      'Rechnung',
      <a href={b.stripe_invoice_url} target="_blank" rel="noreferrer" className="underline">
        Stripe-Rechnung öffnen
      </a>,
    ]);
  if (b.stripe_payment_intent_id)
    rows.push([
      'Stripe-Zahlung',
      <span className="font-mono text-xs">{b.stripe_payment_intent_id}</span>,
    ]);
  if (b.admin_override) rows.push(['Hinweis', 'Vom Admin trotz Sperre/Buchungsschluss angelegt']);
  if (b.cancelled_at)
    rows.push(['Storniert', `${formatDateTime(b.cancelled_at)} – ${b.cancel_reason ?? ''}`]);
  if (b.anonymized_at) rows.push(['Anonymisiert', formatDateTime(b.anonymized_at)]);

  return (
    <Dialog open onClose={onClose} title={`Buchung ${b.booking_code}`} wide>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold text-ink-soft">{k}</dt>
            <dd className="mb-2 break-words sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>

      {paid && !b.anonymized_at && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          <button
            type="button"
            className={smallBtn}
            disabled={busy}
            onClick={() =>
              void run('Ticket wurde erneut verschickt.', async () => {
                const r = await callAdmin('resend_ticket', { booking_id: b.id });
                return r.ok ? null : r.message;
              })
            }
          >
            Ticket erneut senden
          </button>
          {!b.checked_in_at && (
            <button
              type="button"
              className={smallBtn}
              disabled={busy}
              onClick={() =>
                void run('Eingecheckt.', rpc('admin_check_in', { p_booking_id: b.id }))
              }
            >
              Einchecken
            </button>
          )}
          {!b.taler_handed_out_at && (
            <button
              type="button"
              className={smallBtn}
              disabled={busy}
              onClick={() =>
                void run(
                  'Taler als übergeben markiert.',
                  rpc('admin_mark_taler', { p_booking_id: b.id }),
                )
              }
            >
              Taler übergeben
            </button>
          )}
          <button
            type="button"
            className={`${smallBtn} text-red-800`}
            disabled={busy}
            onClick={() => setCancelOpen(true)}
          >
            Stornieren …
          </button>
        </div>
      )}

      {cancelOpen && (
        <div className="mt-5 space-y-3 rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm text-red-950">
            Die Buchung wird storniert, das Zeitfenster wird wieder frei und zählt nicht mehr zur
            Abrechnung. <strong>Eine Erstattung musst du selbst in Stripe auslösen.</strong>
          </p>
          <label className="block text-sm">
            <span className="field-label">Grund (Pflicht)</span>
            <input
              className="field-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={dangerBtn}
              disabled={busy || !reason.trim()}
              onClick={() =>
                void run(
                  'Buchung storniert.',
                  rpc('admin_cancel_booking', { p_booking_id: b.id, p_reason: reason.trim() }),
                ).then(() => setCancelOpen(false))
              }
            >
              Endgültig stornieren
            </button>
            <button type="button" className={smallBtn} onClick={() => setCancelOpen(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div className="mt-4">
          {msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>}
        </div>
      )}

      <h3 className="mb-2 mt-6 font-semibold">E-Mail-Verlauf</h3>
      {log.data && log.data.length === 0 && (
        <p className="text-sm text-ink-soft">Noch keine E-Mails.</p>
      )}
      {log.data && log.data.length > 0 && (
        <ul className="space-y-1 text-sm">
          {log.data.map((l) => (
            <li key={l.id}>
              <span className="tabular-nums">{formatDateTime(l.created_at)}</span> ·{' '}
              {EMAIL_TYPE[l.type] ?? l.type} ·{' '}
              <span
                className={l.status === 'sent' ? 'text-emerald-800' : 'font-semibold text-red-800'}
              >
                {l.status === 'sent'
                  ? 'verschickt'
                  : `fehlgeschlagen${l.error ? `: ${l.error}` : ''}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
