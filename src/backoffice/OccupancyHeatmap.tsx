import { formatCents } from '@/lib/money';
import { percent } from './admin/format';
import { heatStep } from './heatStep';
import { unwrap, useLoad } from './admin/useLoad';
import { requireClient } from './authClient';
import { errorText } from './errors';
import { ErrorBox, Loading, Panel } from './ui';

export interface HeatmapRow {
  weekday: number;
  start_time: string;
  offered: number;
  booked: number;
  revenue_cents: number | null;
}

const DAYS = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Fünf Stufen: 0 % (Fläche) und vier Gold-Töne. Textfarbe passend zum Kontrast. */
const STEPS = [
  { label: '0 %', bg: 'bg-surface ring-1 ring-inset ring-line', text: 'text-ink-soft' },
  { label: 'bis 25 %', bg: 'bg-heat-1', text: 'text-ink' },
  { label: 'bis 50 %', bg: 'bg-heat-2', text: 'text-ink' },
  { label: 'bis 75 %', bg: 'bg-heat-3', text: 'text-white' },
  { label: 'über 75 %', bg: 'bg-heat-4', text: 'text-white' },
] as const;

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Auslastung je Wochentag (Zeilen) und Zeitfenster (Zellen). Eine Größe, eine Farbskala;
 * Hover/Fokus zeigt die Zahlen, darunter dieselben Werte als Tabelle.
 */
export function OccupancyHeatmap({ rows }: { rows: HeatmapRow[] }) {
  const rated = rows.filter((r) => r.offered > 0);
  if (!rows.length || (!rated.length && !rows.some((r) => r.booked))) {
    return <p className="text-ink-soft">Im gewählten Zeitraum gibt es keine Zeitfenster.</p>;
  }
  const best = [...rated].sort((a, b) => b.booked / b.offered - a.booked / a.offered)[0];
  const showRevenue = rows.some((r) => r.revenue_cents !== null);

  return (
    <figure>
      {best && best.booked > 0 && (
        <figcaption className="mb-4 text-sm text-ink-soft">
          Am gefragtesten:{' '}
          <strong className="text-ink">
            {DAYS[best.weekday]} {hhmm(best.start_time)} Uhr
          </strong>{' '}
          ({percent(best.booked, best.offered)} ausgelastet)
        </figcaption>
      )}
      <div className="space-y-1.5" role="list" aria-label="Auslastung je Wochentag und Zeitfenster">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const cells = rows.filter((r) => r.weekday === wd);
          if (!cells.length) return null;
          return (
            <div key={wd} className="flex items-stretch gap-1.5" role="listitem">
              <span className="w-8 shrink-0 self-center text-sm font-semibold text-ink-soft">
                {SHORT[wd]}
              </span>
              {cells.map((c) => {
                const step = STEPS[heatStep(c.booked, c.offered)]!;
                const tip = `${DAYS[wd]} ${hhmm(c.start_time)} Uhr: ${c.booked} von ${c.offered} gebucht${
                  c.offered ? ` (${percent(c.booked, c.offered)})` : ''
                }${c.revenue_cents !== null ? ` · ${formatCents(c.revenue_cents)}` : ''}`;
                return (
                  <div
                    key={c.start_time}
                    tabIndex={0}
                    aria-label={tip}
                    className={`group relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-md px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ink ${step.bg} ${step.text}`}
                  >
                    <span className="text-[11px] leading-none">{hhmm(c.start_time)}</span>
                    <span className="mt-1 text-sm leading-none font-semibold tabular-nums">
                      {c.offered ? percent(c.booked, c.offered) : '–'}
                    </span>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-snug text-paper shadow-lg group-hover:block group-focus-visible:block"
                    >
                      {tip}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <ul
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft"
        aria-label="Legende"
      >
        {STEPS.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-5 rounded-sm ${s.bg}`} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-gold-deep">
          Als Tabelle anzeigen
        </summary>
        <table className="mt-3 w-full text-left tabular-nums">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 font-semibold">Tag</th>
              <th className="py-1 font-semibold">Zeit</th>
              <th className="py-1 text-right font-semibold">Gebucht</th>
              <th className="py-1 text-right font-semibold">Angeboten</th>
              <th className="py-1 text-right font-semibold">Auslastung</th>
              {showRevenue && <th className="py-1 text-right font-semibold">Umsatz</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.weekday}-${r.start_time}`} className="border-t border-line">
                <td className="py-1">{SHORT[r.weekday]}</td>
                <td className="py-1">{hhmm(r.start_time)}</td>
                <td className="py-1 text-right">{r.booked}</td>
                <td className="py-1 text-right">{r.offered}</td>
                <td className="py-1 text-right">
                  {r.offered ? percent(r.booked, r.offered) : '–'}
                </td>
                {showRevenue && (
                  <td className="py-1 text-right">
                    {r.revenue_cents !== null ? formatCents(r.revenue_cents) : '–'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Lädt die Auslastung für den Zeitraum und zeigt die Heatmap in einem Panel. */
export function OccupancyHeatmapPanel({ from, to }: { from: string; to: string }) {
  const data = useLoad(
    async () =>
      unwrap(
        await requireClient().rpc('occupancy_heatmap', { p_from: from, p_to: to }),
      ) as HeatmapRow[],
    [from, to],
  );
  return (
    <Panel title="Auslastung nach Wochentag und Uhrzeit" className="mt-8">
      {data.loading && !data.data && <Loading />}
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      {data.data && <OccupancyHeatmap rows={data.data} />}
    </Panel>
  );
}
