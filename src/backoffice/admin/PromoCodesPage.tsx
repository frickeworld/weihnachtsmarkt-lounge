import { useState, type FormEvent } from 'react';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader, Panel, SuccessBox, smallBtn } from '../ui';
import { formatDay } from './format';
import { unwrap, useLoad } from './useLoad';

interface PromoCode {
  code: string;
  percent: number;
  valid_from: string | null;
  bookable_until: string;
  max_uses: number | null;
  allow_specials: boolean;
  active: boolean;
  note: string | null;
  uses: number;
  discount_cents: number;
  revenue_cents: number;
}

const EMPTY = {
  code: '',
  percent: '10',
  validFrom: '',
  until: '',
  maxUses: '',
  allowSpecials: false,
  note: '',
};

/**
 * Rabattcodes für Aktionen (z. B. LOUNGE10). Der Rabatt gilt nie auf den Freiverzehr; Gewinnspiel-
 * Codes entstehen automatisch beim Gewinnspiel und stehen nicht hier.
 */
export function PromoCodesPage() {
  const list = useLoad(
    async () => unwrap(await requireClient().rpc('admin_promo_codes')) as PromoCode[],
    [],
  );
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const percent = Number(f.percent);
    if (!/^[A-Za-z0-9-]{4,24}$/.test(f.code.trim()))
      return setMsg({
        ok: false,
        text: 'Der Code braucht 4–24 Zeichen: Buchstaben, Ziffern oder Bindestrich.',
      });
    if (!Number.isInteger(percent) || percent < 1 || percent > 90)
      return setMsg({ ok: false, text: 'Rabatt bitte zwischen 1 und 90 %.' });
    if (!f.until) return setMsg({ ok: false, text: 'Bitte das Datum „Buchbar bis“ angeben.' });
    setBusy(true);
    const { data, error } = await requireClient().rpc('admin_create_promo_code', {
      p_code: f.code,
      p_percent: percent,
      p_bookable_until: f.until,
      p_max_uses: f.maxUses ? Number(f.maxUses) : null,
      p_allow_specials: f.allowSpecials,
      p_note: f.note,
      p_valid_from: f.validFrom || null,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errorText(error) });
    setMsg({ ok: true, text: `Code ${String(data)} angelegt.` });
    setF(EMPTY);
    list.reload();
  };

  const toggle = async (c: PromoCode) => {
    const { error } = await requireClient().rpc('admin_set_promo_active', {
      p_code: c.code,
      p_active: !c.active,
    });
    if (error) setMsg({ ok: false, text: errorText(error) });
    list.reload();
  };

  return (
    <>
      <PageHeader title="Rabattcodes" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Für Aktionen, z. B. <strong>LOUNGE10</strong> = 10 % bis zu einem Datum. Gäste geben den
        Code beim Buchen ein. Der Freiverzehr bleibt immer voll, die Verarbeitungsgebühr auch. Die
        Händler bekommen ihren Anteil vom rabattierten Lounge-Preis (mindestens den Freiverzehr).
        Gewinnspiel-Codes entstehen automatisch und stehen nicht hier.
      </p>

      <Panel title="Neuer Code" className="mb-8">
        <form onSubmit={(e) => void create(e)} noValidate className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="field-label">Code</span>
            <input
              className="field-input font-mono uppercase"
              value={f.code}
              maxLength={24}
              placeholder="LOUNGE10"
              onChange={(e) => setF({ ...f, code: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Rabatt in %</span>
            <input
              type="number"
              min={1}
              max={90}
              className="field-input"
              value={f.percent}
              onChange={(e) => setF({ ...f, percent: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Max. Einlösungen (leer = unbegrenzt)</span>
            <input
              type="number"
              min={1}
              className="field-input"
              value={f.maxUses}
              onChange={(e) => setF({ ...f, maxUses: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Gültig ab (optional)</span>
            <input
              type="date"
              className="field-input"
              value={f.validFrom}
              onChange={(e) => setF({ ...f, validFrom: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Buchbar bis</span>
            <input
              type="date"
              className="field-input"
              value={f.until}
              onChange={(e) => setF({ ...f, until: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Notiz (intern, optional)</span>
            <input
              className="field-input"
              maxLength={200}
              value={f.note}
              onChange={(e) => setF({ ...f, note: e.target.value })}
            />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#7a5a1e]"
              checked={f.allowSpecials}
              onChange={(e) => setF({ ...f, allowSpecials: e.target.checked })}
            />
            <span>Auch an Party-Abenden und Heiligabend gültig</span>
          </label>
          <button type="submit" className={`${smallBtn} self-end`} disabled={busy}>
            Code anlegen
          </button>
        </form>
        {msg && (
          <div className="mt-4">
            {msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>}
          </div>
        )}
      </Panel>

      <Panel title="Alle Codes">
        {list.loading && <Loading />}
        {list.error != null && <ErrorBox>{errorText(list.error)}</ErrorBox>}
        {list.data?.length === 0 && <p className="text-ink-soft">Noch keine Rabattcodes.</p>}
        {list.data && list.data.length > 0 && (
          <ul className="divide-y divide-line">
            {list.data.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p>
                    <span className="font-mono text-lg font-semibold">{c.code}</span> · {c.percent}{' '}
                    %{' '}
                    {!c.active && (
                      <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-semibold">
                        ausgeschaltet
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {c.valid_from ? `ab ${formatDay(c.valid_from)}, ` : ''}buchbar bis{' '}
                    {formatDay(c.bookable_until)} ·{' '}
                    {c.max_uses ? `${c.uses} von ${c.max_uses} eingelöst` : `${c.uses} eingelöst`} ·{' '}
                    {c.allow_specials ? 'auch Partys' : 'ohne Partys'}
                    {c.note ? ` · ${c.note}` : ''}
                  </p>
                  {c.uses > 0 && (
                    <p className="text-sm text-ink-soft">
                      Umsatz {formatCents(Number(c.revenue_cents))}, Rabatt{' '}
                      {formatCents(Number(c.discount_cents))}
                    </p>
                  )}
                </div>
                <button type="button" className={smallBtn} onClick={() => void toggle(c)}>
                  {c.active ? 'Ausschalten' : 'Einschalten'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
