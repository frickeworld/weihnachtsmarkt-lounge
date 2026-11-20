import { useState } from 'react';
import { addDays, todayInBerlin } from '@/lib/dates';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Kpi } from '../Kpi';
import { ErrorBox, Loading, Panel } from '../ui';
import { DailyBars } from './DailyBars';
import { unwrap, useLoad } from './useLoad';

interface Count {
  key: string;
  count: number;
}

export interface TrafficData {
  page_views: number;
  /** Besucher: je Tag eindeutig (Hash ohne Cookies), über den Zeitraum aufsummiert */
  visitors?: number;
  today: number;
  visitors_today?: number;
  last_hour: number;
  daily?: { date: string; page_views: number; visitors: number }[];
  by_source: Count[];
  by_page: Count[];
  by_device: Count[];
  by_hour: { hour: number; count: number }[];
}

const SOURCE_LABEL: Record<string, string> = {
  direkt: 'Direkt (Lesezeichen, eingetippt, QR-Code, Apps)',
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  bing: 'Bing',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  'weihnachtsmarkt-detmold.de': 'weihnachtsmarkt-detmold.de',
  unbekannt: 'Ohne Angabe (vor dem 10.11.)',
};
const PAGE_LABEL: Record<string, string> = { start: 'Startseite', gewinnspiel: 'Gewinnspiel' };
const DEVICE_LABEL: Record<string, string> = { mobile: 'Handy', desktop: 'Computer / Tablet' };

/**
 * Aufruf-Tracker (Entscheidung Louis, 10.11.2026): Woher die Besucher kommen, welche Seite, welches
 * Gerät, zu welcher Uhrzeit. Ohne Cookies und ohne IDs – jeder Seitenaufruf zählt einzeln.
 */
/** Seit diesem Tag ist die Seite live (05.11.2026). */
const LIVE_SINCE = '2026-11-05';
type Period = 'heute' | '7' | '30' | 'alles';
const PERIODS: [Period, string][] = [
  ['heute', 'Heute'],
  ['7', '7 Tage'],
  ['30', '30 Tage'],
  ['alles', 'Seit Start'],
];

/** Eigener Zeitraum, unabhängig von „Saison“ oben – die Website läuft schon vor der Saison. */
export function TrafficPanel() {
  const today = todayInBerlin();
  const [period, setPeriod] = useState<Period>('30');
  const from =
    period === 'heute'
      ? today
      : period === '7'
        ? addDays(today, -6)
        : period === '30'
          ? addDays(today, -29)
          : LIVE_SINCE < today
            ? LIVE_SINCE
            : today;
  const data = useLoad(
    async () =>
      unwrap(
        await requireClient().rpc('admin_traffic', { p_from: from, p_to: today }),
      ) as TrafficData,
    [from, today],
  );

  return (
    <Panel title="Besucher und Aufrufe der Website" className="mt-6">
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Zeitraum der Website-Zahlen"
      >
        {PERIODS.map(([p, label]) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
              period === p
                ? 'border-gold-deep bg-gold text-ink'
                : 'border-line bg-surface hover:border-gold'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      {data.loading && <Loading />}
      {data.data && <TrafficView d={data.data} />}
    </Panel>
  );
}

function TrafficView({ d }: { d: TrafficData }) {
  const maxHour = Math.max(1, ...d.by_hour.map((h) => h.count));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Besucher heute"
          value={d.visitors_today ?? d.today}
          sub="verschiedene Personen"
        />
        <Kpi label="Besucher im Zeitraum" value={d.visitors ?? d.page_views} sub="je Tag gezählt" />
        <Kpi label="Seitenaufrufe im Zeitraum" value={d.page_views} />
        <Kpi label="Aufrufe letzte Stunde" value={d.last_hour} />
      </div>

      {d.daily && d.daily.length > 1 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <DailyBars
            title="Besucher pro Tag"
            unit="Besucher"
            points={d.daily.map((x) => ({ date: x.date, value: x.visitors }))}
          />
          <DailyBars
            title="Seitenaufrufe pro Tag"
            unit="Aufrufe"
            points={d.daily.map((x) => ({ date: x.date, value: x.page_views }))}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Bars title="Woher kommen die Besucher?" rows={d.by_source} labels={SOURCE_LABEL} />
        <Bars title="Welche Seite?" rows={d.by_page} labels={PAGE_LABEL} />
        <Bars title="Welches Gerät?" rows={d.by_device} labels={DEVICE_LABEL} />
      </div>

      <h3 className="mt-6 mb-2 font-semibold">Uhrzeit der Aufrufe</h3>
      <div
        className="flex h-28 items-end gap-0.5"
        role="img"
        aria-label={`Aufrufe nach Uhrzeit, meiste um ${
          d.by_hour.reduce((a, b) => (b.count > a.count ? b : a), d.by_hour[0]!).hour
        } Uhr`}
      >
        {d.by_hour.map((h) => (
          <div
            key={h.hour}
            title={`${h.hour}–${h.hour + 1} Uhr: ${h.count}`}
            className="flex-1 rounded-t bg-gold"
            style={{ height: `${Math.max(2, (h.count / maxHour) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-soft">
        <span>0 Uhr</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23 Uhr</span>
      </div>

      <p className="mt-5 text-sm text-ink-soft">
        „Besucher“ zählt jede Person einmal pro Tag, auch wenn sie die Seite mehrmals lädt – ohne
        Cookies und ohne gespeicherte IP-Adresse (Zählung seit 20.11.; davor zählt jeder Aufruf).
        Wer an zwei Tagen kommt, zählt an beiden Tagen. „Seitenaufrufe“ zählt jedes Laden der
        Startseite und der Gewinnspiel-Seite. Tipp: Links mit Herkunft versehen, z. B.{' '}
        <code>?utm_source=plakat</code> für den QR-Code auf dem Plakat oder{' '}
        <code>?utm_source=newsletter</code>, dann erscheint die Quelle hier mit eigenem Namen.
      </p>
    </>
  );
}

function Bars({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: Count[];
  labels: Record<string, string>;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <section>
      <h3 className="mb-2 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Noch keine Aufrufe.</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 8).map((r) => (
            <li key={r.key}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{labels[r.key] ?? r.key}</span>
                <span className="tabular-nums">
                  {r.count} · {Math.round((r.count / total) * 100)} %
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-sand">
                <div
                  className="h-2 rounded-full bg-gold-deep"
                  style={{ width: `${(r.count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
