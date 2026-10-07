import { useState } from 'react';
import { Link } from 'react-router-dom';
import { todayInBerlin } from '@/lib/dates';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, PageHeader, Panel, smallBtn } from '../ui';
import { BOOKING_COLUMNS } from './api';
import { downloadFile } from './csv';
import { bookingsCsv } from './exportRows';
import type { Booking } from './types';
import { unwrap, useLoad } from './useLoad';

export function ExportPage() {
  const today = todayInBerlin();
  const season = useLoad(
    async () =>
      unwrap(
        await requireClient()
          .from('settings')
          .select('season_start, season_end')
          .eq('id', 1)
          .single(),
      ) as {
        season_start: string;
        season_end: string;
      },
    [],
  );
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [onlyPaid, setOnlyPaid] = useState(true);
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r =
    range ??
    (season.data
      ? { from: season.data.season_start, to: season.data.season_end }
      : { from: today, to: today });

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      let q = requireClient()
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .gte('date', r.from)
        .lte('date', r.to)
        .order('date')
        .order('start_time');
      q = onlyPaid ? q.eq('status', 'paid') : q.in('status', ['paid', 'cancelled', 'pending']);
      const rows = unwrap(await q) as Booking[];
      downloadFile(`lounge-buchungen_${r.from}_${r.to}.csv`, bookingsCsv(rows));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Export" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Buchungen als CSV (Excel)">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">Von</span>
              <input
                type="date"
                className="field-input"
                value={r.from}
                onChange={(e) => e.target.value && setRange({ ...r, from: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Bis</span>
              <input
                type="date"
                className="field-input"
                value={r.to}
                min={r.from}
                onChange={(e) => e.target.value && setRange({ ...r, to: e.target.value })}
              />
            </label>
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#7a5a1e]"
              checked={onlyPaid}
              onChange={(e) => setOnlyPaid(e.target.checked)}
            />
            <span>Nur bezahlte Buchungen</span>
          </label>
          <p className="mt-2 text-sm text-ink-soft">
            Enthält Kontaktdaten der Gäste – nur intern verwenden und nach Gebrauch löschen.
          </p>
          {error && (
            <div className="mt-3">
              <ErrorBox>{error}</ErrorBox>
            </div>
          )}
          <button
            type="button"
            className="btn-gold mt-4"
            disabled={busy}
            onClick={() => void exportCsv()}
          >
            {busy ? 'Exportieren …' : 'CSV herunterladen'}
          </button>
        </Panel>
        <Panel title="Tagesliste für das Team">
          <p className="mb-4 text-sm text-ink-soft">
            Druckansicht mit allen Lounges eines Tages. Über „Drucken“ → „Als PDF speichern“
            entsteht ein PDF.
          </p>
          <label className="block">
            <span className="field-label">Tag</span>
            <input
              type="date"
              className="field-input"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/admin/tagesliste/${day}`} className={smallBtn}>
              Tagesliste öffnen
            </Link>
            <Link to={`/admin/belegungsplan/${day}`} className={smallBtn}>
              Belegungsplan (7 Tage ab diesem Tag)
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
