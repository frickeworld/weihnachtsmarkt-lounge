import { useState, type FormEvent } from 'react';
import { formatCents } from '@/lib/money';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader, Panel, SuccessBox, WarnBox, smallBtn } from '../ui';
import { centsToEuroInput, parseEuroToCents } from './format';
import { SlotTemplatesPanel } from './SlotTemplatesPanel';
import type { AdminSettings } from './types';
import { unwrap, useLoad } from './useLoad';

const SETTINGS_COLUMNS =
  'season_start, season_end, price_cents, fee_cents, taler_count, taler_cents, haendler_share_cents, max_persons, booking_cutoff_minutes, hold_minutes, checkin_early_minutes, contact_email, lounge_location, updated_at';

export function SettingsPage() {
  const s = useLoad(
    async () =>
      unwrap(
        await requireClient().from('settings').select(SETTINGS_COLUMNS).eq('id', 1).single(),
      ) as AdminSettings,
    [],
  );
  return (
    <>
      <PageHeader title="Einstellungen" />
      {s.error != null && <ErrorBox>{errorText(s.error)}</ErrorBox>}
      {s.loading && !s.data && <Loading />}
      <div className="grid gap-6 xl:grid-cols-2">
        {s.data && <SettingsForm initial={s.data} onSaved={s.reload} />}
        <div className="space-y-6">
          <SlotTemplatesPanel feeCents={s.data?.fee_cents ?? 350} />
          <ScannerPinPanel />
        </div>
      </div>
    </>
  );
}

type Draft = Record<
  | 'season_start'
  | 'season_end'
  | 'price'
  | 'fee'
  | 'taler_count'
  | 'taler'
  | 'haendler'
  | 'max_persons'
  | 'cutoff'
  | 'hold'
  | 'checkin_early'
  | 'contact_email'
  | 'lounge_location',
  string
>;

function SettingsForm({ initial, onSaved }: { initial: AdminSettings; onSaved: () => void }) {
  const [v, setV] = useState<Draft>({
    season_start: initial.season_start,
    season_end: initial.season_end,
    price: centsToEuroInput(initial.price_cents),
    fee: centsToEuroInput(initial.fee_cents),
    taler_count: String(initial.taler_count),
    taler: centsToEuroInput(initial.taler_cents),
    haendler: centsToEuroInput(initial.haendler_share_cents),
    max_persons: String(initial.max_persons),
    cutoff: String(initial.booking_cutoff_minutes),
    hold: String(initial.hold_minutes),
    checkin_early: String(initial.checkin_early_minutes),
    contact_email: initial.contact_email,
    lounge_location: initial.lounge_location,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  const price = parseEuroToCents(v.price);
  const fee = parseEuroToCents(v.fee);
  const priceChanged =
    price !== initial.price_cents ||
    fee !== initial.fee_cents ||
    parseEuroToCents(v.haendler) !== initial.haendler_share_cents;

  const validate = (): string | Record<string, unknown> => {
    const cents = {
      price,
      fee,
      taler: parseEuroToCents(v.taler),
      haendler: parseEuroToCents(v.haendler),
    };
    if (Object.values(cents).some((c) => c === null))
      return 'Bitte Beträge als Zahl angeben, z. B. 175,00.';
    const int = (x: string) => (/^\d+$/.test(x.trim()) ? Number(x) : NaN);
    const n = {
      taler_count: int(v.taler_count),
      max_persons: int(v.max_persons),
      cutoff: int(v.cutoff),
      hold: int(v.hold),
      checkin_early: int(v.checkin_early),
    };
    if (Object.values(n).some(Number.isNaN)) return 'Bitte ganze Zahlen ohne Komma angeben.';
    if (!v.season_start || !v.season_end || v.season_start > v.season_end)
      return 'Das Saisonende muss nach dem Saisonstart liegen.';
    if (cents.price! <= 0) return 'Der Preis muss größer als 0 sein.';
    if (cents.haendler! > cents.price! || cents.taler! > cents.price!)
      return 'Händler-Anteil und Taler-Wert dürfen den Lounge-Preis nicht übersteigen.';
    if (n.max_persons < 1 || n.max_persons > 50) return 'Personenzahl: 1 bis 50.';
    if (n.hold < 30 || n.hold > 180)
      return 'Reservierung beim Checkout: 30 bis 180 Minuten (Stripe-Minimum 30).';
    if (!/^\S+@\S+\.\S+$/.test(v.contact_email.trim())) return 'Bitte prüfe die Kontakt-E-Mail.';
    if (!v.lounge_location.trim()) return 'Bitte gib den Treffpunkt an.';
    return {
      season_start: v.season_start,
      season_end: v.season_end,
      price_cents: cents.price,
      fee_cents: cents.fee,
      taler_count: n.taler_count,
      taler_cents: cents.taler,
      haendler_share_cents: cents.haendler,
      max_persons: n.max_persons,
      booking_cutoff_minutes: n.cutoff,
      hold_minutes: n.hold,
      checkin_early_minutes: n.checkin_early,
      contact_email: v.contact_email.trim(),
      lounge_location: v.lounge_location.trim(),
    };
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = validate();
    if (typeof r === 'string') return setMsg({ ok: false, text: r });
    setBusy(true);
    const { error } = await requireClient().from('settings').update(r).eq('id', 1);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errorText(error) });
    setMsg({
      ok: true,
      text: 'Gespeichert. Die Website zeigt die neuen Werte beim nächsten Laden.',
    });
    onSaved();
  };

  const input = (
    k: keyof Draft,
    label: string,
    opts: { type?: string; suffix?: string; hint?: string } = {},
  ) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <input
          type={opts.type ?? 'text'}
          inputMode={opts.suffix ? 'decimal' : undefined}
          className={`field-input ${opts.suffix ? 'pr-14' : ''}`}
          value={v[k]}
          onChange={set(k)}
        />
        {opts.suffix && (
          <span className="absolute inset-y-0 right-4 flex items-center text-ink-soft">
            {opts.suffix}
          </span>
        )}
      </span>
      {opts.hint && <span className="mt-1 block text-sm text-ink-soft">{opts.hint}</span>}
    </label>
  );

  return (
    <Panel title="Saison, Preise und Regeln">
      <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {input('season_start', 'Saisonstart', { type: 'date' })}
          {input('season_end', 'Saisonende', { type: 'date' })}
          {input('price', 'Standard: Lounge-Preis ohne Gebühr', { suffix: '€' })}
          {input('fee', 'Vorverkaufsgebühr (in jedem Preis enthalten)', { suffix: '€' })}
          {input('haendler', 'Standard: Anteil Händler', { suffix: '€' })}
          {input('taler_count', 'Standard: Anzahl Residenztaler', { suffix: 'Stk.' })}
          {input('taler', 'Standard: Wert der Taler', { suffix: '€' })}
          {input('max_persons', 'Max. Personen', { suffix: 'Pers.' })}
          {input('cutoff', 'Online-Buchungsschluss vor Beginn', { suffix: 'Min.' })}
          {input('hold', 'Reservierung beim Checkout', { suffix: 'Min.' })}
          {input('checkin_early', 'Check-in frühestens vor Beginn', { suffix: 'Min.' })}
          {input('contact_email', 'Kontakt-E-Mail', { type: 'email' })}
        </div>
        {input('lounge_location', 'Treffpunkt (steht im Ticket)')}
        <p className="text-sm text-ink-soft">
          Die Standardwerte gelten nur für Zeitfenster ohne eigenen Preis. Die Preisstaffel steht
          unter „Zeitfenster und Preise“, Sonderpreise im Kalender.
        </p>
        <p className="text-sm text-ink-soft">
          Standard-Gesamtpreis für Gäste:{' '}
          <strong className="text-ink">
            {price !== null && fee !== null ? formatCents(price + fee) : '–'}
          </strong>
        </p>
        {priceChanged && (
          <WarnBox>
            Preisänderungen gelten nur für neue Buchungen. Bestehende Buchungen behalten ihre
            Beträge.
          </WarnBox>
        )}
        {msg && (msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>)}
        <button type="submit" className="btn-gold" disabled={busy}>
          {busy ? 'Speichern …' : 'Einstellungen speichern'}
        </button>
      </form>
    </Panel>
  );
}

function ScannerPinPanel() {
  const isSet = useLoad(
    async () => unwrap(await requireClient().rpc('admin_scanner_pin_set')) as boolean,
    [],
  );
  const [pin, setPin] = useState('');
  const [repeat, setRepeat] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin))
      return setMsg({ ok: false, text: 'Die PIN muss genau 6 Ziffern haben.' });
    if (pin !== repeat) return setMsg({ ok: false, text: 'Die PINs stimmen nicht überein.' });
    setBusy(true);
    const { error } = await requireClient().rpc('admin_set_scanner_pin', { p_pin: pin });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errorText(error) });
    setPin('');
    setRepeat('');
    setMsg({
      ok: true,
      text: 'Neue PIN gespeichert. Alle Scanner-Geräte müssen sich neu anmelden.',
    });
    isSet.reload();
  };

  return (
    <Panel title="Scanner-PIN">
      <p className="mb-4 text-sm text-ink-soft">
        {isSet.data
          ? 'Eine PIN ist gesetzt.'
          : 'Noch keine PIN gesetzt – der Scanner ist gesperrt.'}{' '}
        Die PIN wird nur verschlüsselt gespeichert und kann nicht angezeigt werden. Eine neue PIN
        meldet alle Geräte ab. Der Scanner läuft im Handy-Browser unter{' '}
        <a
          href="/scan"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gold-deep underline"
        >
          /scan
        </a>
        .
      </p>
      <form
        onSubmit={(e) => void submit(e)}
        className="grid gap-3 sm:grid-cols-3 sm:items-end"
        noValidate
      >
        <label>
          <span className="field-label">Neue PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            className="field-input tracking-widest"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <label>
          <span className="field-label">Wiederholen</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            className="field-input tracking-widest"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <button type="submit" className={smallBtn} disabled={busy}>
          PIN speichern
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
