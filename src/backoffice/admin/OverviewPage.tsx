import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { addDays, todayInBerlin } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader, Panel } from '../ui';
import { BOOKING_COLUMNS } from './api';
import { Kpi } from '../Kpi';
import { OccupancyHeatmapPanel } from '../OccupancyHeatmap';
import { DailyBars } from './DailyBars';
import { hhmm, percent } from './format';
import type { Booking, DashboardData } from './types';
import { unwrap, useLoad } from './useLoad';

type Preset = 'saison' | 'heute' | '7' | '30' | 'eigen';

export function OverviewPage() {
  const today = todayInBerlin();
  const season = useLoad(
    async () =>
      unwrap(
        await requireClient()
          .from('settings')
          .select('season_start, season_end, vat_percent, studio_share_percent')
          .eq('id', 1)
          .single<{
            season_start: string;
            season_end: string;
            vat_percent: number;
            studio_share_percent: number;
          }>(),
      ),
    [],
  );
  const [preset, setPreset] = useState<Preset>('saison');
  const [custom, setCustom] = useState({ from: addDays(today, -6), to: today });

  const range: { from: string; to: string } | null =
    preset === 'heute'
      ? { from: today, to: today }
      : preset === '7'
        ? { from: addDays(today, -6), to: today }
        : preset === '30'
          ? { from: addDays(today, -29), to: today }
          : preset === 'eigen'
            ? custom
            : season.data
              ? { from: season.data.season_start, to: season.data.season_end }
              : null;

  const dash = useLoad(async () => {
    if (!range) return null;
    return unwrap(
      await requireClient().rpc('admin_dashboard', { p_from: range.from, p_to: range.to }),
    ) as DashboardData;
  }, [range?.from, range?.to]);

  const todays = useLoad(
    async () =>
      unwrap(
        await requireClient()
          .from('bookings')
          .select(BOOKING_COLUMNS)
          .eq('date', today)
          .in('status', ['paid', 'pending'])
          .order('start_time'),
      ) as Booking[],
    [today],
  );

  const d = dash.data;
  const vat = season.data?.vat_percent ?? 19;
  const studioPct = season.data?.studio_share_percent ?? 28;
  const presets: { id: Preset; label: string }[] = [
    { id: 'saison', label: 'Saison' },
    { id: 'heute', label: 'Heute' },
    { id: '7', label: '7 Tage' },
    { id: '30', label: '30 Tage' },
    { id: 'eigen', label: 'Zeitraum' },
  ];

  return (
    <>
      <PageHeader title="Übersicht" />

      <Panel title="Heute" className="mb-8">
        {todays.loading && <Loading />}
        {todays.error != null && <ErrorBox>{errorText(todays.error)}</ErrorBox>}
        {todays.data && todays.data.length === 0 && (
          <p className="text-ink-soft">Heute ist keine Lounge gebucht.</p>
        )}
        {todays.data && todays.data.length > 0 && (
          <ul className="divide-y divide-line">
            {todays.data.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <span className="font-semibold tabular-nums">
                    {hhmm(b.start_time)}–{hhmm(b.end_time)}
                  </span>{' '}
                  · {b.first_name} {b.last_name} · {b.persons} Pers.
                  {b.status === 'pending' && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">
                      Zahlung offen
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={b.checked_in_at ? 'font-semibold text-emerald-800' : 'text-ink-soft'}
                  >
                    {b.checked_in_at ? '✓ Eingecheckt' : 'Noch nicht da'}
                  </span>
                  <Link
                    to={`/admin/buchungen?code=${b.booking_code}`}
                    className="font-semibold text-gold-deep underline underline-offset-4"
                  >
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4">
          <Link
            to={`/admin/tagesliste/${today}`}
            className="font-semibold text-gold-deep underline underline-offset-4"
          >
            Tagesliste zum Drucken
          </Link>
        </p>
      </Panel>

      <div className="mb-6 flex flex-wrap items-end gap-2" role="group" aria-label="Zeitraum">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset === p.id}
            onClick={() => setPreset(p.id)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              preset === p.id
                ? 'border-gold-deep bg-gold text-ink'
                : 'border-line bg-surface hover:border-gold-deep'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'eigen' && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="field-label">Von</span>
              <input
                type="date"
                className="field-input"
                value={custom.from}
                onChange={(e) =>
                  e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="field-label">Bis</span>
              <input
                type="date"
                className="field-input"
                value={custom.to}
                min={custom.from}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </label>
          </div>
        )}
      </div>

      {dash.error != null && <ErrorBox>{errorText(dash.error)}</ErrorBox>}
      {(dash.loading || !d) && !dash.error && <Loading />}
      {d && (
        <>
          <KpiGroup title="Buchungen und Umsatz">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi
                label="Gebuchte Lounges"
                value={d.paid_bookings}
                sub={`von ${d.available_slots} Zeitfenstern`}
              />
              <Kpi label="Auslastung" value={percent(d.paid_bookings, d.available_slots)} />
              <Kpi label="Umsatz brutto" value={formatCents(d.revenue_cents)} sub="inkl. MwSt." />
              <Kpi
                label="Umsatz netto"
                value={formatCents(Math.round(d.revenue_cents / (1 + vat / 100)))}
                sub={`ohne ${vat.toLocaleString('de-DE')} % MwSt.`}
              />
            </div>
          </KpiGroup>
          <KpiGroup title="Aufteilung">
            <div className="grid gap-3 md:grid-cols-2">
              <ShareCard
                label="Anteil Händler"
                value={formatCents(d.haendler_cents)}
                sub={`${100 - studioPct} % vom Lounge-Preis, mindestens der Freiverzehr`}
              />
              <ShareCard
                label="Anteil Studio F"
                value={formatCents(d.studio_cents)}
                sub={`${studioPct} % vom Lounge-Preis plus Verarbeitungsgebühr`}
              />
            </div>
          </KpiGroup>
          <KpiGroup title="Website">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Kpi label="Seitenaufrufe" value={d.page_views} />
              <Kpi label="Klicks „Lounge buchen“" value={d.book_clicks} />
              <Kpi
                label="Abschlussquote"
                value={percent(d.online_paid_in_period, d.book_clicks)}
                sub="Online-Buchungen ÷ Klicks"
              />
            </div>
          </KpiGroup>
          <KpiGroup title="Am Einlass">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Kpi label="Eingecheckt" value={d.checked_in} sub="schon da gewesen" />
              <Kpi
                label="Noch erwartet"
                value={Math.max(0, d.paid_bookings - d.checked_in - d.no_shows)}
                sub="Termin kommt noch"
              />
              <Kpi
                label="Nicht erschienen"
                value={d.no_shows}
                sub="Zeitfenster vorbei, kein Check-in"
              />
              <Kpi label="Residenztaler übergeben" value={d.taler_handed_out} />
              <Kpi label="Offen / storniert" value={`${d.pending} / ${d.cancelled}`} />
            </div>
          </KpiGroup>
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
          {range && <OccupancyHeatmapPanel from={range.from} to={range.to} />}
        </>
      )}
    </>
  );
}

function KpiGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="eyebrow mb-3">{title}</h2>
      {children}
    </section>
  );
}

/** Große Kachel für die Aufteilung – Tannengrün mit Gold. */
function ShareCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="on-dark relative overflow-hidden rounded-[24px] bg-brown p-6 text-on-dark sm:p-7">
      <div className="glitter absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
      <div className="text-sm font-semibold tracking-[0.12em] text-gold-light uppercase">
        {label}
      </div>
      <div className="mt-2 font-display text-4xl font-medium text-gold-light tabular-nums sm:text-5xl">
        {value}
      </div>
      <div className="mt-2 text-sm text-on-dark/75">{sub}</div>
    </div>
  );
}
