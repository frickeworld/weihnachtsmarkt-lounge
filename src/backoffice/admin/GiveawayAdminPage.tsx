import { useState, type FormEvent } from 'react';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { Kpi } from '../Kpi';
import { ErrorBox, Loading, PageHeader, Panel, SuccessBox, WarnBox } from '../ui';
import { callAdmin } from './api';
import { downloadFile, toCsv } from './csv';
import { formatDateTime } from './format';
import { unwrap, useLoad } from './useLoad';

interface Overview {
  settings: {
    giveaway_active: boolean;
    giveaway_end: string | null;
    giveaway_discount_percent: number;
  };
  entries: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
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
  codes: {
    code: string;
    kind: string;
    percent: number;
    entry_id: string | null;
    redeem_by: string | null;
  }[];
}

/** Gewinnspiel: ein-/ausschalten, Kennzahlen, Gewinner ziehen, bisherige Ziehungen. */
export function GiveawayAdminPage() {
  const data = useLoad(async (): Promise<Overview> => {
    const c = requireClient();
    const [settings, entries, draws, redeemed, codes] = await Promise.all([
      c
        .from('settings')
        .select('giveaway_active, giveaway_end, giveaway_discount_percent')
        .eq('id', 1)
        .single(),
      c
        .from('giveaway_entries')
        .select(
          'id, first_name, last_name, email, created_at, confirmed_at, unsubscribed_at, won_draw_id, referred_by, company',
        )
        .order('created_at', { ascending: false }),
      c
        .from('giveaway_draws')
        .select('id, drawn_at, pool_size, lots, mails_sent, winner_entry_id')
        .order('id', { ascending: false }),
      c
        .from('bookings')
        .select('discount_code, amount_total_cents, status')
        .not('discount_code', 'is', null)
        .eq('status', 'paid'),
      c.from('discount_codes').select('code, kind, percent, entry_id, redeem_by'),
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
      codes: unwrap(codes) as Overview['codes'],
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
                <strong>
                  Automatisch: erste Ziehung Sa 28.11. um 20:00 Uhr, danach jeden Sonntag um 18:00
                  Uhr
                </strong>
                , solange das Gewinnspiel aktiv ist. Von Hand nur, wenn eine Ziehung nachgeholt
                werden muss. Gezogen wird per Zufall unter allen bestätigten Teilnehmenden, die noch
                nicht gewonnen haben (Freunde-Bonus: 1 Extra-Los je bestätigtem Freund). Danach
                gehen sofort raus: dem Gewinner sein 100-%-Code, allen anderen ihr persönlicher{' '}
                {d.settings.giveaway_discount_percent}-%-Code, 48 Stunden einlösbar (alle Tage außer
                Sonderveranstaltungen).
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

          <Panel title={`Teilnehmer (${d.entries.length})`} className="mt-6">
            {d.entries.length === 0 ? (
              <p className="text-ink-soft">Noch niemand angemeldet.</p>
            ) : (
              <>
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-semibold text-gold-deep underline underline-offset-4"
                    onClick={() =>
                      downloadFile(
                        'gewinnspiel-teilnehmer.csv',
                        toCsv(
                          [
                            'Vorname',
                            'Nachname',
                            'E-Mail',
                            'Firma',
                            'Angemeldet',
                            'Status',
                            'Eingeladen von',
                            'Codes',
                            'Lose',
                          ],
                          d.entries.map((e) => [
                            e.first_name,
                            e.last_name,
                            e.email,
                            e.company,
                            formatDateTime(e.created_at),
                            entryStatus(e),
                            inviter(e, d.entries),
                            codesOf(e, d)
                              .map((c) => `${c.code} (${c.label})`)
                              .join(', '),
                            lotsOf(e, d.entries),
                          ]),
                        ),
                      )
                    }
                  >
                    Als CSV herunterladen
                  </button>
                </div>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Teilnehmer">
                  <table className="w-full text-left text-sm">
                    <thead className="text-ink-soft">
                      <tr>
                        <th className="py-1 font-semibold">Name</th>
                        <th className="py-1 font-semibold">E-Mail</th>
                        <th className="py-1 font-semibold">Angemeldet</th>
                        <th className="py-1 font-semibold">Status</th>
                        <th className="py-1 font-semibold">Eingeladen von</th>
                        <th className="py-1 font-semibold">Codes</th>
                        <th className="py-1 text-right font-semibold">Lose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.entries.map((e) => (
                        <tr key={e.id} className="border-t border-line align-top">
                          <td className="py-2">
                            {e.first_name} {e.last_name}
                            {e.company && <div className="text-ink-soft">{e.company}</div>}
                          </td>
                          <td className="py-2 break-all">{e.email}</td>
                          <td className="py-2 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                          <td className="py-2">{entryStatus(e)}</td>
                          <td className="py-2">{inviter(e, d.entries)}</td>
                          <td className="py-2">
                            {codesOf(e, d).map((c) => (
                              <div key={c.code} className="whitespace-nowrap">
                                <span className="font-mono">{c.code}</span> · {c.label}
                              </div>
                            ))}
                          </td>
                          <td className="py-2 text-right tabular-nums">{lotsOf(e, d.entries)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

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

type Entry = Overview['entries'][number];

function entryStatus(e: Entry): string {
  if (e.unsubscribed_at) return 'abgemeldet';
  if (e.won_draw_id) return 'gewonnen';
  if (e.confirmed_at) return 'im Lostopf';
  return 'wartet auf Bestätigung (E-Mail)';
}

/** 1 Los, plus 1 je bestätigtem Freund – nur solange im Lostopf. */
function lotsOf(e: Entry, all: Entry[]): number {
  if (!e.confirmed_at || e.unsubscribed_at || e.won_draw_id) return 0;
  return (
    1 + all.filter((x) => x.referred_by === e.id && x.confirmed_at && !x.unsubscribed_at).length
  );
}

function inviter(e: Entry, all: Entry[]): string {
  const x = e.referred_by ? all.find((y) => y.id === e.referred_by) : undefined;
  return x ? `${x.first_name} ${x.last_name}` : '–';
}

/** Gewinnspiel-Codes einer Person mit Art und Einlösestatus. */
function codesOf(e: Entry, d: Overview): { code: string; label: string }[] {
  return d.codes
    .filter((c) => c.entry_id === e.id)
    .map((c) => {
      const used = d.redeemed.some((r) => r.discount_code === c.code);
      const expired = !used && c.redeem_by != null && new Date(c.redeem_by) < new Date();
      const kind = c.kind === 'gewinn' ? 'Gewinn 100 %' : `Trostpreis ${c.percent} %`;
      return {
        code: c.code,
        label: `${kind}, ${used ? 'eingelöst' : expired ? 'abgelaufen' : 'offen'}`,
      };
    });
}
