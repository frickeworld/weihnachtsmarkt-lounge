import { Link, useParams } from 'react-router-dom';
import { addDays, formatLongDate } from '@/lib/dates';
import { useNoindex } from '@/lib/useNoindex';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, smallBtn } from '../ui';
import { BOOKING_COLUMNS } from './api';
import { hhmm } from './format';
import { OCCASION_LABEL, type Booking } from './types';
import { unwrap, useLoad } from './useLoad';

interface Slot {
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

/**
 * Belegungsplan für eine Woche (ab dem gewählten Tag, 7 Tage) zum Ausdrucken – für den
 * Tischservice der Tanzschule Fricke: jedes Zeitfenster mit Gast, Personen, Anlass, Wünschen
 * und Platz für Notizen. Freie Zeitfenster stehen als „frei“ dabei.
 */
export function WeekPlanPage() {
  useNoindex();
  const { from = '' } = useParams();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from);
  const to = valid ? addDays(from, 6) : from;
  const data = useLoad(async () => {
    if (!valid) return null;
    const c = requireClient();
    const [slots, bookings] = await Promise.all([
      c.rpc('get_availability', { from_date: from, to_date: to }),
      c
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .gte('date', from)
        .lte('date', to)
        .eq('status', 'paid')
        .order('date')
        .order('start_time'),
    ]);
    return { slots: unwrap(slots) as Slot[], bookings: unwrap(bookings) as Booking[] };
  }, [from]);

  const days = valid ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) : [];
  const d = data.data;
  const totalPersons = d?.bookings.reduce((n, b) => n + b.persons, 0) ?? 0;

  return (
    <main className="mx-auto max-w-5xl bg-white px-6 py-8 text-ink print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/admin/export" className={smallBtn}>
          ← Zurück
        </Link>
        <div className="flex gap-2">
          {valid && (
            <>
              <Link to={`/admin/belegungsplan/${addDays(from, -7)}`} className={smallBtn}>
                ← Woche davor
              </Link>
              <Link to={`/admin/belegungsplan/${addDays(from, 7)}`} className={smallBtn}>
                Woche danach →
              </Link>
            </>
          )}
          <button type="button" className="btn-gold" onClick={() => window.print()}>
            Drucken / als PDF speichern
          </button>
        </div>
      </div>
      <h1 className="text-3xl font-medium">Lounge der Händler – Belegungsplan</h1>
      <p className="mb-6 text-lg">
        {valid ? `${formatLongDate(from)} bis ${formatLongDate(to)}` : 'Ungültiges Datum'}
        {d && (
          <span className="text-ink-soft">
            {' '}
            · {d.bookings.length} Lounges · {totalPersons} Gäste
          </span>
        )}
      </p>
      {data.loading && <Loading />}
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      {d &&
        days.map((day) => {
          const slots = d.slots.filter(
            (s) => s.slot_date === day && (s.status === 'free' || s.status === 'taken'),
          );
          const bookingsOfDay = d.bookings.filter((b) => b.date === day);
          if (!slots.length && !bookingsOfDay.length) return null;
          const times = [
            ...new Set([
              ...slots.map((s) => s.start_time),
              ...bookingsOfDay.map((b) => b.start_time),
            ]),
          ].sort();
          return (
            <section key={day} className="mb-6 break-inside-avoid">
              <h2 className="mb-2 border-b-2 border-ink pb-1 text-xl font-medium">
                {formatLongDate(day)}
              </h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {times.map((t) => {
                    const b = bookingsOfDay.find((x) => x.start_time === t);
                    const s = slots.find((x) => x.start_time === t);
                    return (
                      <tr key={t} className="border-b border-line align-top">
                        <td className="w-28 py-2 pr-3 font-semibold tabular-nums">
                          {hhmm(t)}–{hhmm(b?.end_time ?? s?.end_time ?? t)}
                        </td>
                        {b ? (
                          <>
                            <td className="py-2 pr-3">
                              {b.first_name} {b.last_name}
                              {b.company_name && (
                                <div className="text-ink-soft">{b.company_name}</div>
                              )}
                            </td>
                            <td className="w-16 py-2 pr-3 tabular-nums">{b.persons} Pers.</td>
                            <td className="py-2 pr-3">
                              {b.occasion ? (OCCASION_LABEL[b.occasion] ?? b.occasion) : ''}
                              {b.notes && <div className="text-ink-soft">{b.notes}</div>}
                            </td>
                            <td className="w-40 py-2 text-ink-soft">
                              <div className="mt-3 border-b border-dotted border-ink-soft" />
                            </td>
                          </>
                        ) : (
                          <td colSpan={4} className="py-2 text-ink-soft italic">
                            frei
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      <p className="mt-8 text-xs text-ink-soft">
        Enthält personenbezogene Daten – nach der Veranstaltung vernichten. Letzte Spalte: Platz für
        Notizen des Tischservice.
      </p>
    </main>
  );
}
