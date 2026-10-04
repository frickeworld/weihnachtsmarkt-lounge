import { todayInBerlin } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { DailyBars } from '../admin/DailyBars';
import { hhmm, percent } from '../admin/format';
import { unwrap, useLoad } from '../admin/useLoad';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Kpi } from '../Kpi';
import { PeriodPicker } from '../PeriodPicker';
import { usePeriod } from '../usePeriod';
import { ErrorBox, Loading, PageHeader, Panel } from '../ui';
import { BookingState } from './BookingStatus';
import type { HaendlerBooking, HaendlerDashboard } from './types';

export function HaendlerOverview() {
  const today = todayInBerlin();
  const periodState = usePeriod('saison');
  const { period } = periodState;
  const todays = useLoad(
    async () =>
      unwrap(
        await requireClient().rpc('haendler_bookings', { p_from: today, p_to: today }),
      ) as HaendlerBooking[],
    [today],
  );
  const dash = useLoad(
    async () =>
      unwrap(
        await requireClient().rpc('haendler_dashboard', { p_from: period.from, p_to: period.to }),
      ) as HaendlerDashboard,
    [period.from, period.to],
  );
  const d = dash.data;

  return (
    <>
      <PageHeader title="Übersicht" />
      <Panel title="Heute in der Lounge" className="mb-8">
        {todays.loading && <Loading />}
        {todays.error != null && <ErrorBox>{errorText(todays.error)}</ErrorBox>}
        {todays.data?.length === 0 && (
          <p className="text-ink-soft">Heute ist keine Lounge gebucht.</p>
        )}
        {todays.data && todays.data.length > 0 && (
          <ul className="divide-y divide-line">
            {todays.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="font-semibold tabular-nums">
                    {hhmm(b.start_time)}–{hhmm(b.end_time)}
                  </span>{' '}
                  · {b.first_name} {b.last_name}
                  {b.company_name ? ` (${b.company_name})` : ''} · {b.persons} Pers.
                </span>
                <BookingState b={b} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <PeriodPicker state={periodState} />
      {dash.error != null && <ErrorBox>{errorText(dash.error)}</ErrorBox>}
      {dash.loading && <Loading />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Gebuchte Lounges"
              value={d.paid_bookings}
              sub={`von ${d.available_slots} Zeitfenstern`}
            />
            <Kpi label="Auslastung" value={percent(d.paid_bookings, d.available_slots)} />
            <Kpi
              label="Euer Anteil"
              value={formatCents(d.haendler_cents)}
              sub="137,50 € je bezahlter Buchung"
            />
            <Kpi label="Residenztaler übergeben" value={d.taler_handed_out} />
            <Kpi label="Seitenaufrufe" value={d.page_views} />
            <Kpi label="Klicks „Lounge buchen“" value={d.book_clicks} />
            <Kpi
              label="Abschlussquote"
              value={percent(d.online_paid_in_period, d.book_clicks)}
              sub="Online-Buchungen ÷ Klicks"
            />
            <Kpi label="Erschienen / nicht erschienen" value={`${d.checked_in} / ${d.no_shows}`} />
          </div>
          {d.daily.length > 1 && (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <DailyBars
                title="Online-Buchungen pro Tag (Zahlungstag)"
                unit="Buchungen"
                points={d.daily.map((x) => ({ date: x.date, value: x.bookings }))}
              />
              <DailyBars
                title="Seitenaufrufe pro Tag"
                unit="Aufrufe"
                points={d.daily.map((x) => ({ date: x.date, value: x.page_views }))}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
