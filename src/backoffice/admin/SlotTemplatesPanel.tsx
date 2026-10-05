import { useState } from 'react';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, Panel, SuccessBox, smallBtn } from '../ui';
import { centsToEuroInput, hhmm, parseEuroToCents } from './format';
import { autoHaendlerShare } from './pricing';
import type { SlotTemplate } from './types';
import { unwrap, useLoad } from './useLoad';

const DAY_NAMES = [
  '',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];
const COLUMNS =
  'id, weekday, start_time, end_time, active, price_cents, taler_count, haendler_share_cents, label';

interface Draft {
  price: string;
  taler: string;
  share: string;
  label: string;
}

const draftOf = (t: SlotTemplate): Draft => ({
  price: t.price_cents !== null ? centsToEuroInput(t.price_cents) : '',
  taler: t.taler_count !== null ? String(t.taler_count) : '',
  share: t.haendler_share_cents !== null ? centsToEuroInput(t.haendler_share_cents) : '',
  label: t.label ?? '',
});

/** Prüft die Eingaben einer Zeile und baut das Update (Beträge in Cent). */
function toUpdate(
  d: Draft,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  const price = parseEuroToCents(d.price);
  if (price === null || price <= 0)
    return { ok: false, message: 'Bitte einen Preis angeben, z. B. 149,00.' };
  if (!/^\d+$/.test(d.taler.trim()))
    return { ok: false, message: 'Freiverzehr bitte als ganze Euro, z. B. 75.' };
  const taler = Number(d.taler);
  if (taler * 100 > price)
    return { ok: false, message: 'Der Freiverzehr darf nicht höher als der Preis sein.' };
  let share: number | null = null;
  if (d.share.trim()) {
    share = parseEuroToCents(d.share);
    if (share === null || share > price)
      return { ok: false, message: 'Händler-Anteil bitte prüfen (höchstens der Preis).' };
  }
  return {
    ok: true,
    value: {
      price_cents: price,
      taler_count: taler,
      haendler_share_cents: share,
      label: d.label.trim() || null,
    },
  };
}

/** Zeitfenster je Wochentag mit Preis, Freiverzehr und Händler-Anteil (Preisstaffel). */
export function SlotTemplatesPanel({ feeCents }: { feeCents: number }) {
  const t = useLoad(
    async () =>
      unwrap(
        await requireClient()
          .from('slot_templates')
          .select(COLUMNS)
          .order('weekday')
          .order('start_time'),
      ) as SlotTemplate[],
    [],
  );
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [showInactive, setShowInactive] = useState(false);
  const [add, setAdd] = useState({
    weekday: '1',
    start: '',
    end: '',
    price: '',
    taler: '',
    label: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    setMsg(null);
    const { error } = await p;
    setMsg(error ? { ok: false, text: errorText(error) } : { ok: true, text: ok });
    t.reload();
    return !error;
  };

  const rows = (t.data ?? []).filter((s) => showInactive || s.active);

  return (
    <Panel title="Zeitfenster und Preise">
      <p className="mb-4 text-sm text-ink-soft">
        Preis = Endpreis für den Gast inkl. {formatCents(feeCents)} Vorverkaufsgebühr. Der
        Händler-Anteil ergibt sich automatisch (Freiverzehr + Hälfte des Rests), kann aber fest
        eingetragen werden. Änderungen gelten nur für neue Buchungen. Sonderpreise für einzelne
        Termine legst du im Kalender fest.
      </p>
      <label className="mb-3 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#7a5a1e]"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Inaktive (alte) Zeitfenster anzeigen
      </label>
      {t.loading && !t.data && <Loading />}
      <ul className="divide-y divide-line text-sm">
        {rows.map((s) => {
          const d = drafts[s.id] ?? draftOf(s);
          const dirty = JSON.stringify(d) !== JSON.stringify(draftOf(s));
          const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
            setDrafts((x) => ({ ...x, [s.id]: { ...d, [k]: e.target.value } }));
          const price = parseEuroToCents(d.price);
          const auto =
            price !== null && /^\d+$/.test(d.taler.trim())
              ? autoHaendlerShare(price, feeCents, Number(d.taler))
              : null;
          const id = `tpl-${s.id}`;
          return (
            <li key={s.id} className={`py-3 ${s.active ? '' : 'opacity-60'}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="inline-block w-24 font-semibold">{DAY_NAMES[s.weekday]}</span>
                  <span className="tabular-nums">
                    {hhmm(s.start_time)}–{hhmm(s.end_time)}
                  </span>
                  {!s.active && <span className="ml-2 text-xs">(inaktiv)</span>}
                </span>
                <button
                  type="button"
                  className={smallBtn}
                  onClick={() =>
                    void run(
                      requireClient()
                        .from('slot_templates')
                        .update({ active: !s.active })
                        .eq('id', s.id),
                      s.active ? 'Zeitfenster deaktiviert.' : 'Zeitfenster aktiviert.',
                    )
                  }
                >
                  {s.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
                <label>
                  <span className="text-xs text-ink-soft">Bezeichnung</span>
                  <input
                    id={`${id}-label`}
                    className="field-input !min-h-11 !py-2"
                    placeholder="Abend"
                    value={d.label}
                    onChange={set('label')}
                  />
                </label>
                <label>
                  <span className="text-xs text-ink-soft">Preis €</span>
                  <input
                    className="field-input !min-h-11 !py-2"
                    inputMode="decimal"
                    placeholder="Standard"
                    value={d.price}
                    onChange={set('price')}
                    aria-label={`Preis ${DAY_NAMES[s.weekday]} ${hhmm(s.start_time)}`}
                  />
                </label>
                <label>
                  <span className="text-xs text-ink-soft">Freiverzehr €</span>
                  <input
                    className="field-input !min-h-11 !py-2"
                    inputMode="numeric"
                    placeholder="Standard"
                    value={d.taler}
                    onChange={set('taler')}
                    aria-label={`Freiverzehr ${DAY_NAMES[s.weekday]} ${hhmm(s.start_time)}`}
                  />
                </label>
                <label>
                  <span className="text-xs text-ink-soft">Händler-Anteil €</span>
                  <input
                    className="field-input !min-h-11 !py-2"
                    inputMode="decimal"
                    placeholder={auto !== null ? `auto ${centsToEuroInput(auto)}` : 'automatisch'}
                    value={d.share}
                    onChange={set('share')}
                  />
                </label>
                <button
                  type="button"
                  className={smallBtn}
                  disabled={!dirty}
                  onClick={() => {
                    const u = toUpdate(d);
                    if (!u.ok) return setMsg({ ok: false, text: u.message });
                    void run(
                      requireClient().from('slot_templates').update(u.value).eq('id', s.id),
                      `${DAY_NAMES[s.weekday]} ${hhmm(s.start_time)}: gespeichert.`,
                    ).then(
                      (ok) =>
                        ok && setDrafts((x) => ({ ...x, [s.id]: undefined as unknown as Draft })),
                    );
                  }}
                >
                  Speichern
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-6 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!add.start || !add.end || add.start >= add.end)
            return setMsg({ ok: false, text: 'Bitte Beginn vor Ende angeben.' });
          const u = toUpdate({ price: add.price, taler: add.taler, share: '', label: add.label });
          if (!u.ok) return setMsg({ ok: false, text: u.message });
          void run(
            requireClient()
              .from('slot_templates')
              .insert({
                weekday: Number(add.weekday),
                start_time: add.start,
                end_time: add.end,
                ...u.value,
              }),
            'Zeitfenster hinzugefügt.',
          ).then((ok) => ok && setAdd((a) => ({ ...a, start: '', end: '' })));
        }}
      >
        <label className="col-span-2 sm:col-span-1">
          <span className="field-label">Wochentag</span>
          <select
            className="field-input"
            value={add.weekday}
            onChange={(e) => setAdd((a) => ({ ...a, weekday: e.target.value }))}
          >
            {DAY_NAMES.slice(1).map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Beginn</span>
          <input
            type="time"
            className="field-input"
            value={add.start}
            onChange={(e) => setAdd((a) => ({ ...a, start: e.target.value }))}
          />
        </label>
        <label>
          <span className="field-label">Ende</span>
          <input
            type="time"
            className="field-input"
            value={add.end}
            onChange={(e) => setAdd((a) => ({ ...a, end: e.target.value }))}
          />
        </label>
        <label>
          <span className="field-label">Preis €</span>
          <input
            className="field-input"
            inputMode="decimal"
            value={add.price}
            onChange={(e) => setAdd((a) => ({ ...a, price: e.target.value }))}
          />
        </label>
        <label>
          <span className="field-label">Freiverzehr €</span>
          <input
            className="field-input"
            inputMode="numeric"
            value={add.taler}
            onChange={(e) => setAdd((a) => ({ ...a, taler: e.target.value }))}
          />
        </label>
        <button type="submit" className={`${smallBtn} col-span-2 sm:col-span-1`}>
          Hinzufügen
        </button>
      </form>
      {msg && (
        <div className="mt-3">
          {msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>}
        </div>
      )}
    </Panel>
  );
}
