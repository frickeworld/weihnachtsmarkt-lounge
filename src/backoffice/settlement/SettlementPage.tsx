import { useState } from 'react';
import { formatCents } from '@/lib/money';
import { downloadFile } from '../admin/csv';
import { formatDay } from '../admin/format';
import { unwrap, useLoad } from '../admin/useLoad';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Kpi } from '../Kpi';
import { PeriodPicker } from '../PeriodPicker';
import { usePeriod } from '../usePeriod';
import { ErrorBox, Loading, PageHeader, smallBtn } from '../ui';
import { periodLabel, SETTLEMENT_FOOTER, settlementCsv, settlementPdf } from './exports';
import type { Settlement } from './types';

/** Abrechnung – gleiche Seite für Händler und Admin. Admins sehen zusätzlich Umsatz und Studio-F-Anteil. */
export function SettlementPage() {
  const periodState = usePeriod('saison');
  const { period } = periodState;
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const data = useLoad(
    async () =>
      unwrap(
        await requireClient().rpc('settlement', { p_from: period.from, p_to: period.to }),
      ) as Settlement,
    [period.from, period.to],
  );
  const s = data.data;
  const admin = s?.revenue_cents !== null && s?.revenue_cents !== undefined;
  const fileBase = s ? `Abrechnung-Lounge_${s.from}_${s.to}` : 'Abrechnung';

  const pdf = async () => {
    if (!s) return;
    setBusy('pdf');
    try {
      const logo = await fetch('/email/haendler-logo-weiss.png')
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => (b ? new Uint8Array(b) : null))
        .catch(() => null);
      const bytes = await settlementPdf(s, logo);
      const url = URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBase}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Abrechnung">
        <button
          type="button"
          className={smallBtn}
          disabled={!s || busy !== null}
          onClick={() => s && downloadFile(`${fileBase}.csv`, settlementCsv(s))}
        >
          CSV (Excel)
        </button>
        <button
          type="button"
          className="btn-gold !min-h-11"
          disabled={!s || busy !== null}
          onClick={() => void pdf()}
        >
          {busy === 'pdf' ? 'PDF wird erstellt …' : 'PDF herunterladen'}
        </button>
      </PageHeader>
      <PeriodPicker state={periodState} />

      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      {data.loading && <Loading />}
      {s && (
        <>
          <p className="mb-4 text-ink-soft">Zeitraum {periodLabel(s)} (Datum der Lounge)</p>
          <div className={`grid grid-cols-2 gap-3 ${admin ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
            <Kpi label="Buchungen" value={s.count} sub={`davon ${s.no_shows} nicht erschienen`} />
            <Kpi
              label={admin ? 'Anteil Händler' : 'Euer Anteil'}
              value={formatCents(s.haendler_cents)}
            />
            <Kpi
              label="Nicht berechnet"
              value={s.excluded_cancelled + s.excluded_not_in_settlement}
              sub={`${s.excluded_cancelled} storniert, ${s.excluded_not_in_settlement} kostenlos/ausgenommen`}
            />
            {admin && <Kpi label="Umsatz brutto" value={formatCents(s.revenue_cents ?? 0)} />}
            {admin && <Kpi label="Anteil Studio F" value={formatCents(s.studio_cents ?? 0)} />}
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Berechnet werden alle bezahlten Buchungen – auch wenn die Gäste nicht erschienen sind.
            Stornierte und kostenlose Buchungen zählen nicht. {SETTLEMENT_FOOTER}
          </p>

          <div className="card mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand text-left">
                <tr>
                  <th className="px-3 py-3 font-semibold">Termin</th>
                  <th className="px-3 py-3 font-semibold">Gast</th>
                  <th className="px-3 py-3 font-semibold">Pers.</th>
                  <th className="px-3 py-3 font-semibold">Erschienen</th>
                  {admin && <th className="px-3 py-3 text-right font-semibold">Gesamt</th>}
                  <th className="px-3 py-3 text-right font-semibold">
                    {admin ? 'Händler' : 'Euer Anteil'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.rows.length === 0 && (
                  <tr>
                    <td colSpan={admin ? 6 : 5} className="px-3 py-6 text-center text-ink-soft">
                      Keine Buchungen in diesem Zeitraum.
                    </td>
                  </tr>
                )}
                {s.rows.map((r) => (
                  <tr key={r.booking_code} className="border-t border-line">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDay(r.date)}, {r.start_time}–{r.end_time}
                    </td>
                    <td className="px-3 py-2">
                      {r.name}
                      {r.company_name && (
                        <div className="text-xs text-ink-soft">{r.company_name}</div>
                      )}
                      <div className="font-mono text-xs text-ink-soft">{r.booking_code}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.persons}</td>
                    <td className="px-3 py-2">{r.checked_in ? '✓ ja' : 'nein'}</td>
                    {admin && (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCents(r.amount_total_cents ?? 0)}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCents(r.haendler_share_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {s.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-ink font-semibold">
                    <td className="px-3 py-3" colSpan={4}>
                      Summe ({s.count} Buchungen)
                    </td>
                    {admin && (
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCents(s.revenue_cents ?? 0)}
                      </td>
                    )}
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatCents(s.haendler_cents)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </>
  );
}
