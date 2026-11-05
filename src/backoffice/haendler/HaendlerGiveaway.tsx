import { formatDateTime } from '../admin/format';
import { unwrap, useLoad } from '../admin/useLoad';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Kpi } from '../Kpi';
import { ErrorBox, Loading, PageHeader, Panel } from '../ui';

interface GiveawaySummary {
  active: boolean;
  end: string | null;
  discount_percent: number;
  next_draw: string | null;
  entries_confirmed: number;
  entries_pending: number;
  referrals: number;
  codes_redeemed: number;
  draws: { drawn_at: string; pool_size: number; lots: number; winner: string | null }[];
}

/** Gewinnspiel für Händler – nur lesen, ohne E-Mail-Adressen. */
export function HaendlerGiveaway() {
  const data = useLoad(
    async () => unwrap(await requireClient().rpc('haendler_giveaway_summary')) as GiveawaySummary,
    [],
  );
  const d = data.data;
  return (
    <>
      <PageHeader title="Gewinnspiel" />
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      {data.loading && <Loading />}
      {d && (
        <>
          <p className="mb-6 text-ink-soft">
            {d.active
              ? `Läuft${d.next_draw ? ` · nächste Ziehung ${formatDateTime(d.next_draw)}` : ''} · Trostpreis ${d.discount_percent} % Rabatt`
              : 'Das Gewinnspiel ist gerade nicht aktiv.'}
          </p>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Teilnehmer (bestätigt)" value={d.entries_confirmed} />
            <Kpi label="Noch nicht bestätigt" value={d.entries_pending} />
            <Kpi label="Über Freunde" value={d.referrals} sub="bestätigte Empfehlungen" />
            <Kpi label="Codes eingelöst" value={d.codes_redeemed} sub="bezahlte Buchungen" />
          </div>
          <Panel title="Ziehungen">
            {d.draws.length === 0 ? (
              <p className="text-ink-soft">Noch keine Ziehung.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.draws.map((x) => (
                  <li key={x.drawn_at} className="flex flex-wrap justify-between gap-2 py-3">
                    <span className="font-semibold">{formatDateTime(x.drawn_at)}</span>
                    <span>
                      {x.winner ?? 'kein Gewinner'} · {x.pool_size} Teilnehmer, {x.lots} Lose
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
