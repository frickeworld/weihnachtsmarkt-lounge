import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Kpi } from '../Kpi';
import { ErrorBox, Loading, Panel } from '../ui';
import { unwrap, useLoad } from './useLoad';

interface Count {
  key: string;
  count: number;
}

export interface TrafficData {
  page_views: number;
  today: number;
  last_hour: number;
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
export function TrafficPanel({ from, to }: { from: string; to: string }) {
  const data = useLoad(
    async () =>
      unwrap(await requireClient().rpc('admin_traffic', { p_from: from, p_to: to })) as TrafficData,
    [from, to],
  );

  return (
    <Panel title="Aufrufe der Website" className="mt-6">
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
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Im Zeitraum" value={d.page_views} />
        <Kpi label="Heute" value={d.today} />
        <Kpi label="Letzte Stunde" value={d.last_hour} />
      </div>

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
        Gezählt wird jeder Aufruf der Startseite und der Gewinnspiel-Seite, ohne Cookies und ohne
        Wiedererkennung – lädt jemand die Seite zweimal, zählt das zweimal. Tipp: Links mit Herkunft
        versehen, z. B. <code>?utm_source=plakat</code> für den QR-Code auf dem Plakat oder{' '}
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
