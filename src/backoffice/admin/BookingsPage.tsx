import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addDays, todayInBerlin } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader } from '../ui';
import { BOOKING_COLUMNS } from './api';
import { BookingDetail, StatusBadge } from './BookingDetail';
import { formatDay, hhmm } from './format';
import { STATUS_LABEL, type Booking, type BookingStatus } from './types';
import { unwrap, useLoad } from './useLoad';

const LIMIT = 500;

export function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const today = todayInBerlin();
  const [from, setFrom] = useState(params.get('von') ?? addDays(today, -60));
  const [to, setTo] = useState(params.get('bis') ?? addDays(today, 120));
  const [status, setStatus] = useState<BookingStatus | 'alle'>(
    params.get('code') ? 'alle' : 'paid',
  );
  const [q, setQ] = useState(params.get('code') ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openCode = params.get('code');

  const list = useLoad(async () => {
    let query = requireClient()
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('start_time')
      .limit(LIMIT);
    if (status !== 'alle') query = query.eq('status', status);
    return unwrap(await query) as Booking[];
  }, [from, to, status]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!list.data) return [];
    if (!needle) return list.data;
    return list.data.filter((b) =>
      [b.booking_code, b.first_name, b.last_name, b.email, b.company_name ?? '', b.phone]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [list.data, q]);

  // Deep-Link ?code=… öffnet die Buchung direkt.
  const selected =
    list.data?.find((b) => b.id === selectedId) ??
    (openCode && selectedId === null
      ? list.data?.find((b) => b.booking_code === openCode)
      : undefined);

  const close = () => {
    setSelectedId('');
    if (openCode) {
      params.delete('code');
      setParams(params, { replace: true });
    }
  };

  return (
    <>
      <PageHeader title="Buchungen">
        <Link to="/admin/neue-buchung" className="btn-gold">
          Neue Buchung
        </Link>
      </PageHeader>

      <div className="card mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="field-label">Von</span>
          <input
            type="date"
            className="field-input"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Bis</span>
          <input
            type="date"
            className="field-input"
            value={to}
            min={from}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Status</span>
          <select
            className="field-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus | 'alle')}
          >
            <option value="alle">Alle</option>
            {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Suche</span>
          <input
            type="search"
            className="field-input"
            placeholder="Name, Code, E-Mail, Firma"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      {list.error != null && <ErrorBox>{errorText(list.error)}</ErrorBox>}
      {list.loading && !list.data && <Loading />}
      {list.data && (
        <>
          <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'Buchung' : 'Buchungen'}
            {list.data.length === LIMIT && ' (Ausschnitt – bitte Zeitraum eingrenzen)'}
          </p>

          {/* Mobil: Karten */}
          <ul className="space-y-3 md:hidden">
            {filtered.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className="card w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">
                      {formatDay(b.date)} · {hhmm(b.start_time)}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="mt-1">
                    {b.first_name} {b.last_name} · {b.persons} Pers.
                  </div>
                  <div className="mt-1 font-mono text-xs text-ink-soft">{b.booking_code}</div>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: Tabelle */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-sand text-left">
                <tr>
                  <th className="px-3 py-3 font-semibold">Termin</th>
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Pers.</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold">Betrag</th>
                  <th className="px-3 py-3 font-semibold">Check-in</th>
                  <th className="px-3 py-3 font-semibold">Code</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-line hover:bg-paper">
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDay(b.date)}, {hhmm(b.start_time)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(b.id)}
                        className="min-h-11 text-left font-semibold text-gold-deep underline underline-offset-4"
                      >
                        {b.first_name} {b.last_name}
                      </button>
                      {b.company_name && (
                        <div className="text-xs text-ink-soft">{b.company_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{b.persons}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={b.status} />
                      {b.source === 'manual' && (
                        <span className="ml-1 text-xs text-ink-soft">manuell</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCents(b.amount_total_cents)}
                    </td>
                    <td className="px-3 py-2">{b.checked_in_at ? '✓' : '–'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.booking_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && <BookingDetail booking={selected} onClose={close} onChanged={list.reload} />}
    </>
  );
}
