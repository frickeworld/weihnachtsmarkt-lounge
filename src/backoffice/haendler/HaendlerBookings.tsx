import { useMemo, useState } from 'react';
import { csvEuro, downloadFile, toCsv } from '../admin/csv';
import { formatDay, hhmm } from '../admin/format';
import { OCCASION_LABEL } from '../admin/types';
import { unwrap, useLoad } from '../admin/useLoad';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { PeriodPicker } from '../PeriodPicker';
import { usePeriod } from '../usePeriod';
import { ErrorBox, Loading, PageHeader, smallBtn } from '../ui';
import { BookingState } from './BookingStatus';
import type { HaendlerBooking } from './types';

type Filter = 'alle' | 'bezahlt' | 'storniert' | 'nicht_erschienen';

/** Buchungen ohne Kontaktdaten – lesen und als CSV exportieren. */
export function HaendlerBookings() {
  const periodState = usePeriod('saison');
  const { period } = periodState;
  const [filter, setFilter] = useState<Filter>('alle');
  const [q, setQ] = useState('');
  const list = useLoad(
    async () =>
      unwrap(
        await requireClient().rpc('haendler_bookings', { p_from: period.from, p_to: period.to }),
      ) as HaendlerBooking[],
    [period.from, period.to],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list.data ?? []).filter((b) => {
      if (filter === 'bezahlt' && b.status !== 'paid') return false;
      if (filter === 'storniert' && b.status !== 'cancelled') return false;
      if (filter === 'nicht_erschienen' && !b.no_show) return false;
      if (!needle) return true;
      return [b.first_name, b.last_name, b.company_name ?? '', b.booking_code]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [list.data, filter, q]);

  return (
    <>
      <PageHeader title="Buchungen" />
      <PeriodPicker state={periodState} />
      <div className="card mb-6 grid gap-4 p-4 sm:grid-cols-2">
        <label>
          <span className="field-label">Status</span>
          <select
            className="field-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="alle">Alle</option>
            <option value="bezahlt">Bezahlt</option>
            <option value="storniert">Storniert</option>
            <option value="nicht_erschienen">Nicht erschienen</option>
          </select>
        </label>
        <label>
          <span className="field-label">Suche</span>
          <input
            type="search"
            className="field-input"
            placeholder="Name, Firma, Code"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {list.error != null && <ErrorBox>{errorText(list.error)}</ErrorBox>}
      {list.loading && <Loading />}
      {list.data && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft" aria-live="polite">
              {rows.length} {rows.length === 1 ? 'Buchung' : 'Buchungen'}
            </p>
            <button
              type="button"
              className={smallBtn}
              disabled={rows.length === 0}
              onClick={() =>
                downloadFile(`lounge-buchungen-${period.from}-${period.to}.csv`, haendlerCsv(rows))
              }
            >
              CSV (Excel) herunterladen
            </button>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((b) => (
              <li key={b.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">
                    {formatDay(b.slot_date)} · {hhmm(b.start_time)}
                  </span>
                  <BookingState b={b} />
                </div>
                <div className="mt-1">
                  {b.first_name} {b.last_name} · {b.persons} Pers.
                </div>
                {b.company_name && <div className="text-sm text-ink-soft">{b.company_name}</div>}
                {b.taler_handed_out_at && (
                  <div className="mt-1 text-sm text-emerald-800">✓ Taler übergeben</div>
                )}
              </li>
            ))}
          </ul>
          <div
            className="card hidden overflow-x-auto md:block"
            tabIndex={0}
            role="region"
            aria-label="Buchungsliste"
          >
            <table className="w-full text-sm">
              <thead className="bg-sand text-left">
                <tr>
                  <th className="px-3 py-3 font-semibold">Termin</th>
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Firma</th>
                  <th className="px-3 py-3 font-semibold">Pers.</th>
                  <th className="px-3 py-3 font-semibold">Anlass</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Taler</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDay(b.slot_date)}, {hhmm(b.start_time)}–{hhmm(b.end_time)}
                    </td>
                    <td className="px-3 py-2">
                      {b.first_name} {b.last_name}
                    </td>
                    <td className="px-3 py-2">{b.company_name ?? '–'}</td>
                    <td className="px-3 py-2 tabular-nums">{b.persons}</td>
                    <td className="px-3 py-2">
                      {b.occasion ? (OCCASION_LABEL[b.occasion] ?? b.occasion) : '–'}
                    </td>
                    <td className="px-3 py-2">
                      <BookingState b={b} />
                    </td>
                    <td className="px-3 py-2">{b.taler_handed_out_at ? '✓' : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/** Export ohne Kontaktdaten – dieselben Spalten, die Händler auch auf dem Bildschirm sehen. */
function haendlerCsv(rows: HaendlerBooking[]): string {
  return toCsv(
    [
      'Datum',
      'Beginn',
      'Ende',
      'Code',
      'Vorname',
      'Nachname',
      'Firma',
      'Personen',
      'Anlass',
      'Status',
      'Eingecheckt',
      'Taler übergeben',
      'Händler-Anteil (€)',
    ],
    rows.map((b) => [
      b.slot_date,
      hhmm(b.start_time),
      hhmm(b.end_time),
      b.booking_code,
      b.first_name,
      b.last_name,
      b.company_name,
      b.persons,
      b.occasion ? (OCCASION_LABEL[b.occasion] ?? b.occasion) : '',
      b.status === 'cancelled' ? 'storniert' : b.no_show ? 'nicht erschienen' : 'bezahlt',
      b.checked_in_at ? 'ja' : 'nein',
      b.taler_handed_out_at ? 'ja' : 'nein',
      b.include_in_settlement ? csvEuro(b.haendler_share_cents) : '0,00',
    ]),
  );
}
