import { useState, type FormEvent } from 'react';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Kpi } from '../Kpi';
import { ErrorBox, Loading, PageHeader, Panel, SuccessBox, WarnBox } from '../ui';
import { callAdmin } from './api';
import { formatDateTime } from './format';
import { unwrap, useLoad } from './useLoad';

interface Overview {
  settings: {
    giveaway_active: boolean;
    giveaway_end: string | null;
    giveaway_discount_percent: number;
  };
  entries: {
    confirmed_at: string | null;
    unsubscribed_at: string | null;
    won_draw_id: number | null;
    referred_by: string | null;
    company: string | null;
  }[];
  draws: {
    id: number;
    drawn_at: string;
    pool_size: number;
    lots: number;
    mails_sent: number;
    winner_entry_id: string | null;
  }[];
  winners: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company: string | null;
  }[];
  redeemed: { discount_code: string | null; amount_total_cents: number; status: string }[];
}

/** Gewinnspiel: ein-/ausschalten, Kennzahlen, Gewinner ziehen, bisherige Ziehungen. */
export function GiveawayAdminPage() {
  const data = useLoad(async (): Promise<Overview> => {
    const c = requireClient();
    const [settings, entries, draws, redeemed] = await Promise.all([
      c
        .from('settings')
        .select('giveaway_active, giveaway_end, giveaway_discount_percent')
        .eq('id', 1)
        .single(),
      c
        .from('giveaway_entries')
        .select('confirmed_at, unsubscribed_at, won_draw_id, referred_by, company'),
      c
        .from('giveaway_draws')
        .select('id, drawn_at, pool_size, lots, mails_sent, winner_entry_id')
        .order('id', { ascending: false }),
      c
        .from('bookings')
        .select('discount_code, amount_total_cents, status')
        .not('discount_code', 'is', null)
        .eq('status', 'paid'),
    ]);
    const d = unwrap(draws) as Overview['draws'];
    const ids = d.map((x) => x.winner_entry_id).filter((x): x is string => !!x);
    const winners = ids.length
      ? (unwrap(
          await c
            .from('giveaway_entries')
            .select('id, first_name, last_name, email, company')
            .in('id', ids),
        ) as Overview['winners'])
      : [];
    return {
      settings: unwrap(settings) as Overview['settings'],
      entries: unwrap(entries) as Overview['entries'],
      draws: d,
      winners,
      redeemed: unwrap(redeemed) as Overview['redeemed'],
    };
  }, []);

  const [form, setForm] = useState<{ active: boolean; end: string; percent: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDraw, setConfirmDraw] = useState(false);

  const d = data.data;
  const f =
    form ??
    (d
      ? {
          active: d.settings.giveaway_active,
          end: d.settings.giveaway_end ?? '',
          percent: String(d.settings.giveaway_discount_percent),
        }
      : null);
  const confirmed = d?.entries.filter((e) => e.confirmed_at && !e.unsubscribed_at) ?? [];
  const inPool = confirmed.filter((e) => !e.won_draw_id);
  const companies = confirmed.filter((e) => e.company).length;
  const viaFriends = confirmed.filter((e) => e.referred_by).length;
  const winRedeemed =
    d?.redeemed.filter((r) => (r.discount_code ?? '').startsWith('GEWINN-')).length ?? 0;
  const codeRedeemed =
    d?.redeemed.filter((r) => (r.discount_code ?? '').startsWith('LOUNGE-')) ?? [];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f) return;
    setMsg(null);
    const percent = Number(f.percent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 90)
      return setMsg({ ok: false, text: 'Rabatt bitte als ganze Zahl zwischen 1 und 90.' });
    setBusy(true);
    const { error } = await requireClient()
      .from('settings')
      .update({
        giveaway_active: f.active,
        giveaway_end: f.end || null,
        giveaway_discount_percent: percent,
      })
      .eq('id', 1);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errorText(error) });
    setForm(null);
    setMsg({ ok: true, text: 'Gespeichert.' });
    data.reload();
  };

  const draw = async () => {
    setBusy(true);
    setMsg(null);
    const r = await callAdmin<{
      winner: { firstName: string; email: string };
      participants: number;
      mailsSent: number;
    }>('giveaway_draw');
    setBusy(false);
    setConfirmDraw(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({
      ok: true,
      text: `Gewonnen hat ${r.winner.firstName} (${r.winner.email}). ${r.mailsSent} von ${r.participants} Mails verschickt.`,
    });
    data.reload();
  };

  return (
    <>
      <PageHeader title="Gewinnspiel" />
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      {data.loading && !d && <Loading />}
      {msg && (msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>)}
      {d && f && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Im Lostopf"
              value={inPool.length}
              sub={`${confirmed.length} bestätigt gesamt`}
            />
            <Kpi label="Über Freunde-Link" value={viaFriends} />
            <Kpi label="Mit Firma" value={companies} />
            <Kpi
              label="Ziehungen"
              value={d.draws.length}
              sub={`${winRedeemed} Gewinne eingelöst`}
            />
            <Kpi
              label="Rabatt-Codes eingelöst"
              value={codeRedeemed.length}
              sub={
                formatCents(codeRedeemed.reduce((n, r) => n + r.amount_total_cents, 0)) + ' Umsatz'
              }
            />
            <Kpi label="Unbestätigt" value={d.entries.filter((e) => !e.confirmed_at).length} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Gewinner ziehen">
              <p className="mb-4 text-sm text-ink-soft">
                Zieht per Zufall unter allen bestätigten Teilnehmenden, die noch nicht gewonnen
                haben (Freunde-Bonus: 1 Extra-Los je bestätigtem Freund). Danach gehen sofort raus:
                dem Gewinner sein 100-%-Code, allen anderen ihr persönlicher{' '}
                {d.settings.giveaway_discount_percent}-%-Code (Mo–Do).
              </p>
              {!confirmDraw ? (
                <button
                  type="button"
                  className="btn-gold"
                  disabled={busy || inPool.length === 0}
                  onClick={() => setConfirmDraw(true)}
                >
                  Gewinner ziehen
                </button>
              ) : (
                <WarnBox>
                  <p className="mb-3">
                    Jetzt ziehen und {inPool.length} Mails versenden? Das lässt sich nicht
                    rückgängig machen.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-gold"
                      disabled={busy}
                      onClick={() => void draw()}
                    >
                      {busy ? 'Ziehe …' : 'Ja, jetzt ziehen'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={busy}
                      onClick={() => setConfirmDraw(false)}
                    >
                      Abbrechen
                    </button>
                  </div>
                </WarnBox>
              )}
            </Panel>

            <Panel title="Einstellungen">
              <form onSubmit={(e) => void save(e)} className="space-y-4">
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#7a5a1e]"
                    checked={f.active}
                    onChange={(e) => setForm({ ...f, active: e.target.checked })}
                  />
                  <span>Gewinnspiel aktiv (Band auf der Startseite, Teilnahme möglich)</span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Teilnahme bis (leer = Saisonende)</span>
                    <input
                      type="date"
                      className="field-input"
                      value={f.end}
                      onChange={(e) => setForm({ ...f, end: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="field-label">Rabatt für Nicht-Gewinner (%)</span>
                    <input
                      inputMode="numeric"
                      className="field-input"
                      value={f.percent}
                      onChange={(e) => setForm({ ...f, percent: e.target.value })}
                    />
                  </label>
                </div>
                <p className="text-xs text-ink-soft">
                  Neuer Prozentsatz gilt für Codes, die ab jetzt erstellt werden. Vor dem Start:
                  Teilnahmebedingungen vom Anwalt freigeben lassen.
                </p>
                <button type="submit" className="btn-outline" disabled={busy}>
                  Speichern
                </button>
              </form>
            </Panel>
          </div>

          <Panel title="Bisherige Ziehungen" className="mt-6">
            {d.draws.length === 0 ? (
              <p className="text-ink-soft">Noch keine Ziehung.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-ink-soft">
                  <tr>
                    <th className="py-1 font-semibold">Zeitpunkt</th>
                    <th className="py-1 font-semibold">Gewinner</th>
                    <th className="py-1 text-right font-semibold">Im Topf / Lose</th>
                    <th className="py-1 text-right font-semibold">Mails</th>
                  </tr>
                </thead>
                <tbody>
                  {d.draws.map((x) => {
                    const w = d.winners.find((y) => y.id === x.winner_entry_id);
                    return (
                      <tr key={x.id} className="border-t border-line">
                        <td className="py-2">{formatDateTime(x.drawn_at)}</td>
                        <td className="py-2">
                          {w ? (
                            <>
                              {w.first_name} {w.last_name}
                              {w.company ? ` (${w.company})` : ''}
                              <div className="text-ink-soft">{w.email}</div>
                            </>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {x.pool_size} / {x.lots}
                        </td>
                        <td className="py-2 text-right tabular-nums">{x.mails_sent}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
