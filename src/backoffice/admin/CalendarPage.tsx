import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatLongDate, formatMonth, isoWeekday, monthGrid, todayInBerlin } from '@/lib/dates';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader, Panel, smallBtn } from '../ui';
import { hhmm } from './format';
import { formatCents } from '@/lib/money';
import { autoHaendlerShare } from './pricing';
import { SpecialPriceEditor } from './SpecialPriceEditor';
import type { SlotSpecial, SlotTemplate } from './types';
import { unwrap, useLoad } from './useLoad';

interface MonthData {
  season: {
    season_start: string;
    season_end: string;
    price_cents: number;
    fee_cents: number;
    taler_count: number;
  };
  specials: SlotSpecial[];
  templates: SlotTemplate[];
  closed: { date: string; reason: string | null }[];
  blocked: { date: string; start_time: string; reason: string | null }[];
  bookings: {
    date: string;
    start_time: string;
    status: string;
    first_name: string;
    last_name: string;
    booking_code: string;
    persons: number;
  }[];
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Saison-Kalender: Schließtage und gesperrte Zeitfenster pflegen, Belegung sehen. */
export function CalendarPage() {
  const today = todayInBerlin();
  const [ym, setYm] = useState(() => ({
    y: Number(today.slice(0, 4)),
    m: Number(today.slice(5, 7)),
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const first = `${ym.y}-${String(ym.m).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(ym.y, ym.m, 0)).toISOString().slice(0, 10);

  const data = useLoad(async (): Promise<MonthData> => {
    const c = requireClient();
    const [season, templates, closed, blocked, bookings, specials] = await Promise.all([
      c
        .from('settings')
        .select('season_start, season_end, price_cents, fee_cents, taler_count')
        .eq('id', 1)
        .single(),
      c
        .from('slot_templates')
        .select(
          'id, weekday, start_time, end_time, active, price_cents, taler_count, haendler_share_cents, label',
        )
        .eq('active', true)
        .order('start_time'),
      c.from('closed_dates').select('date, reason').gte('date', first).lte('date', last),
      c
        .from('blocked_slots')
        .select('date, start_time, reason')
        .gte('date', first)
        .lte('date', last),
      c
        .from('bookings')
        .select('date, start_time, status, first_name, last_name, booking_code, persons')
        .gte('date', first)
        .lte('date', last)
        .in('status', ['pending', 'paid']),
      c
        .from('slot_specials')
        .select(
          'date, start_time, title, price_cents, taler_count, haendler_share_cents, act, description',
        )
        .gte('date', first)
        .lte('date', last),
    ]);
    return {
      season: unwrap(season) as MonthData['season'],
      templates: unwrap(templates) as SlotTemplate[],
      closed: unwrap(closed) as MonthData['closed'],
      blocked: unwrap(blocked) as MonthData['blocked'],
      bookings: unwrap(bookings) as MonthData['bookings'],
      specials: unwrap(specials) as SlotSpecial[],
    };
  }, [first, last]);

  const shift = (n: number) => {
    setSelected(null);
    setYm(({ y, m }) => {
      const t = m + n;
      return t < 1 ? { y: y - 1, m: 12 } : t > 12 ? { y: y + 1, m: 1 } : { y, m: t };
    });
  };

  const act = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    setActionError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setActionError(errorText(error));
    else {
      setReason('');
      data.reload();
    }
  };

  const d = data.data;
  const dayInfo = (date: string) => {
    const slots = d?.templates.filter((t) => t.weekday === isoWeekday(date)) ?? [];
    const inSeason = !!d && date >= d.season.season_start && date <= d.season.season_end;
    const closed = d?.closed.find((c) => c.date === date);
    const booked = slots.filter((s) =>
      d?.bookings.some((b) => b.date === date && b.start_time === s.start_time),
    );
    const blocked = slots.filter((s) =>
      d?.blocked.some((b) => b.date === date && b.start_time === s.start_time),
    );
    const specials = d?.specials.filter((x) => x.date === date) ?? [];
    return { slots, inSeason, closed, booked, blocked, specials };
  };

  const sel = selected ? dayInfo(selected) : null;

  return (
    <>
      <PageHeader title="Kalender" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          className={smallBtn}
          onClick={() => shift(-1)}
          aria-label="Vorheriger Monat"
        >
          ←
        </button>
        <h2 className="text-2xl font-medium">{formatMonth(ym.y, ym.m)}</h2>
        <button
          type="button"
          className={smallBtn}
          onClick={() => shift(1)}
          aria-label="Nächster Monat"
        >
          →
        </button>
      </div>
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      {data.loading && !d && <Loading />}
      {d && (
        <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                {WEEKDAYS.map((w) => (
                  <th key={w} className="py-1 font-semibold text-ink-soft">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(ym.y, ym.m).map((week, i) => (
                <tr key={i}>
                  {week.map((date, j) => {
                    if (!date) return <td key={j} />;
                    const info = dayInfo(date);
                    const label = !info.inSeason
                      ? ''
                      : info.closed
                        ? 'geschlossen'
                        : `${info.booked.length}/${info.slots.length} gebucht${info.blocked.length ? ` · ${info.blocked.length} gesperrt` : ''}${info.specials.length ? ' · Sonderpreis' : ''}`;
                    return (
                      <td key={date} className="p-0 align-top">
                        <button
                          type="button"
                          onClick={() => setSelected(date)}
                          aria-pressed={selected === date}
                          aria-label={`${formatLongDate(date)}${label ? `, ${label}` : ', außerhalb der Saison'}`}
                          className={`flex min-h-16 w-full flex-col items-start rounded-lg border p-1.5 text-left sm:min-h-20 ${
                            selected === date ? 'border-gold-deep ring-2 ring-gold' : 'border-line'
                          } ${!info.inSeason ? 'bg-transparent text-ink-soft/60' : info.closed ? 'bg-sand' : info.booked.length === info.slots.length && info.slots.length ? 'bg-gold/25' : 'bg-surface'}`}
                        >
                          <span
                            className={`font-semibold ${date === today ? 'rounded-full bg-ink px-1.5 text-paper' : ''}`}
                          >
                            {Number(date.slice(8))}
                          </span>
                          <span className="mt-0.5 hidden text-[11px] leading-tight text-ink-soft sm:block">
                            {label}
                          </span>
                          {info.inSeason && !info.closed && (
                            <span className="mt-auto flex gap-0.5 sm:hidden" aria-hidden="true">
                              {info.slots.map((s) => (
                                <span
                                  key={s.start_time}
                                  className={`h-1.5 w-3 rounded-full ${info.booked.includes(s) ? 'bg-gold-deep' : info.blocked.includes(s) ? 'bg-ink-soft' : 'bg-line'}`}
                                />
                              ))}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            {!sel || !selected ? (
              <Panel>
                <p className="text-ink-soft">
                  Wähle einen Tag, um Zeitfenster zu sperren, Sonderpreise festzulegen oder den Tag
                  zu schließen.
                </p>
                <p className="mt-3 text-sm text-ink-soft">
                  Saison: {d.season.season_start.split('-').reverse().join('.')} –{' '}
                  {d.season.season_end.split('-').reverse().join('.')} (in den{' '}
                  <Link to="/admin/einstellungen" className="underline">
                    Einstellungen
                  </Link>{' '}
                  änderbar)
                </p>
              </Panel>
            ) : (
              <Panel title={formatLongDate(selected)}>
                {!sel.inSeason && (
                  <p className="mb-3 text-sm text-ink-soft">
                    Außerhalb der Saison – online nicht buchbar.
                  </p>
                )}
                <ul className="space-y-3">
                  {sel.slots.map((s) => {
                    const booking = d.bookings.find(
                      (b) => b.date === selected && b.start_time === s.start_time,
                    );
                    const block = d.blocked.find(
                      (b) => b.date === selected && b.start_time === s.start_time,
                    );
                    const special = sel.specials.find((x) => x.start_time === s.start_time);
                    const stdTotal = s.price_cents ?? d.season.price_cents + d.season.fee_cents;
                    const stdTaler = s.taler_count ?? d.season.taler_count;
                    return (
                      <li key={s.start_time} className="rounded-xl border border-line p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold tabular-nums">
                            {hhmm(s.start_time)}–{hhmm(s.end_time)}
                          </span>
                          <span className="text-sm">
                            {booking
                              ? booking.status === 'paid'
                                ? 'Gebucht'
                                : 'Reserviert'
                              : block
                                ? 'Gesperrt'
                                : 'Frei'}
                          </span>
                        </div>
                        {!special && (
                          <p className="text-sm text-ink-soft">
                            {formatCents(stdTotal)} · {stdTaler} € Freiverzehr · Händler{' '}
                            {formatCents(
                              s.haendler_share_cents ??
                                autoHaendlerShare(stdTotal, d.season.fee_cents, stdTaler),
                            )}
                          </p>
                        )}
                        {booking && (
                          <Link
                            to={`/admin/buchungen?code=${booking.booking_code}`}
                            className="mt-1 block text-sm text-gold-deep underline"
                          >
                            {booking.first_name} {booking.last_name} · {booking.persons} Pers.
                          </Link>
                        )}
                        {block?.reason && (
                          <p className="mt-1 text-sm text-ink-soft">Grund: {block.reason}</p>
                        )}
                        {!booking && (
                          <button
                            type="button"
                            className={`${smallBtn} mt-2`}
                            disabled={busy}
                            onClick={() =>
                              void act(() =>
                                block
                                  ? requireClient()
                                      .from('blocked_slots')
                                      .delete()
                                      .eq('date', selected)
                                      .eq('start_time', s.start_time)
                                  : requireClient()
                                      .from('blocked_slots')
                                      .insert({
                                        date: selected,
                                        start_time: s.start_time,
                                        reason: reason.trim() || null,
                                      }),
                              )
                            }
                          >
                            {block ? 'Sperre aufheben' : 'Zeitfenster sperren'}
                          </button>
                        )}
                        <SpecialPriceEditor
                          key={`${selected}-${s.start_time}-${special?.price_cents ?? ''}`}
                          date={selected}
                          startTime={s.start_time}
                          special={special}
                          feeCents={d.season.fee_cents}
                          booked={!!booking}
                          onChanged={data.reload}
                        />
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-5 border-t border-line pt-4">
                  {sel.closed ? (
                    <>
                      <p className="mb-2 text-sm">
                        <strong>Schließtag</strong>
                        {sel.closed.reason ? ` – ${sel.closed.reason}` : ''}
                      </p>
                      <button
                        type="button"
                        className={smallBtn}
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            requireClient().from('closed_dates').delete().eq('date', selected),
                          )
                        }
                      >
                        Tag wieder öffnen
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm">
                        <span className="field-label">Grund (optional, nur intern)</span>
                        <input
                          className="field-input"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className={`${smallBtn} mt-2`}
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            requireClient()
                              .from('closed_dates')
                              .insert({ date: selected, reason: reason.trim() || null }),
                          )
                        }
                      >
                        Ganzen Tag schließen
                      </button>
                      {sel.booked.length > 0 && (
                        <p className="mt-2 text-sm text-amber-900">
                          Achtung: An diesem Tag gibt es schon Buchungen. Sie bleiben gültig – bitte
                          die Gäste selbst informieren.
                        </p>
                      )}
                    </>
                  )}
                </div>
                {actionError && (
                  <div className="mt-4">
                    <ErrorBox>{actionError}</ErrorBox>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      )}
    </>
  );
}
