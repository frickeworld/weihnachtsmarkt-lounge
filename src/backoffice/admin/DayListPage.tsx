import { Link, useParams } from 'react-router-dom';
import { formatLongDate } from '@/lib/dates';
import { useNoindex } from '@/lib/useNoindex';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, smallBtn } from '../ui';
import { BOOKING_COLUMNS } from './api';
import { hhmm } from './format';
import { OCCASION_LABEL, type Booking } from './types';
import { unwrap, useLoad } from './useLoad';

/** Druckansicht: alle bezahlten Lounges eines Tages (für Tanzschule und Kasse). */
export function DayListPage() {
  useNoindex();
  const { date = '' } = useParams();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const list = useLoad(async () => {
    if (!valid) return [];
    return unwrap(
      await requireClient()
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .eq('date', date)
        .eq('status', 'paid')
        .order('start_time'),
    ) as Booking[];
  }, [date]);

  return (
    <main className="mx-auto max-w-4xl bg-white px-6 py-8 text-ink print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/admin/export" className={smallBtn}>
          ← Zurück
        </Link>
        <button type="button" className="btn-gold" onClick={() => window.print()}>
          Drucken / als PDF speichern
        </button>
      </div>
      <h1 className="text-3xl font-medium">Lounge der Händler – Tagesliste</h1>
      <p className="mb-6 text-lg">{valid ? formatLongDate(date) : 'Ungültiges Datum'}</p>
      {list.loading && <Loading />}
      {list.error != null && <ErrorBox>{errorText(list.error)}</ErrorBox>}
      {list.data && list.data.length === 0 && <p>An diesem Tag ist keine Lounge gebucht.</p>}
      {list.data && list.data.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th className="py-2 pr-3">Zeit</th>
              <th className="py-2 pr-3">Gast</th>
              <th className="py-2 pr-3">Pers.</th>
              <th className="py-2 pr-3">Anlass / Wünsche</th>
              <th className="py-2 pr-3">Code</th>
              <th className="py-2">Da · Taler</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((b) => (
              <tr key={b.id} className="break-inside-avoid border-b border-line align-top">
                <td className="py-3 pr-3 font-semibold tabular-nums">
                  {hhmm(b.start_time)}–{hhmm(b.end_time)}
                </td>
                <td className="py-3 pr-3">
                  {b.first_name} {b.last_name}
                  {b.company_name && <div className="text-ink-soft">{b.company_name}</div>}
                  <div className="text-ink-soft">{b.phone}</div>
                </td>
                <td className="py-3 pr-3 tabular-nums">{b.persons}</td>
                <td className="py-3 pr-3">
                  {b.occasion ? (OCCASION_LABEL[b.occasion] ?? b.occasion) : ''}
                  {b.notes && <div className="text-ink-soft">{b.notes}</div>}
                </td>
                <td className="py-3 pr-3 font-mono text-xs">{b.booking_code}</td>
                <td className="py-3">
                  {b.checked_in_at ? '✓' : '☐'} · {b.taler_handed_out_at ? '✓' : '☐'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-8 text-xs text-ink-soft">
        Enthält personenbezogene Daten – nach der Veranstaltung vernichten.
      </p>
    </main>
  );
}
