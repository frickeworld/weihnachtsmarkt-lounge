import { useState } from 'react';
import { todayInBerlin } from '@/lib/dates';
import { requireClient } from '../authClient';
import { lastCutoff } from './format';
import { errorText } from '../errors';
import { ErrorBox, PageHeader, Panel, SuccessBox, dangerBtn } from '../ui';

export function DataCarePage() {
  const [before, setBefore] = useState(() => lastCutoff(todayInBerlin()));
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    const c = requireClient();
    const { data, error } = await c.rpc('admin_anonymize_before', { p_before: before });
    // Gewinnspiel-Teilnehmer gleich mit anonymisieren (Aktion ist mit der Saison vorbei)
    const giveaway = error ? null : await c.rpc('admin_anonymize_giveaway');
    setBusy(false);
    setConfirm('');
    const err = error ?? giveaway?.error;
    setMsg(
      err
        ? { ok: false, text: errorText(err) }
        : {
            ok: true,
            text: `${data as number} Buchungen und ${(giveaway?.data as number) ?? 0} Gewinnspiel-Teilnahmen anonymisiert. Beträge und Statistik bleiben erhalten.`,
          },
    );
  };

  return (
    <>
      <PageHeader title="Datenpflege" />
      <Panel title="Kundendaten nach der Saison anonymisieren" className="max-w-2xl">
        <p className="mb-4 text-ink-soft">
          Entfernt Namen, E-Mail, Telefon, Firma, Adresse, USt-ID und Wünsche aller Buchungen mit
          Lounge-Datum <strong className="text-ink">vor</strong> dem Stichtag. Beträge, Datum,
          Status und Personenzahl bleiben für Statistik und Abrechnung. Stripe-Rechnungen sind davon
          nicht betroffen (Aufbewahrungspflicht). Außerdem werden alle Gewinnspiel-Teilnahmen
          anonymisiert.{' '}
          <strong className="text-ink">Das lässt sich nicht rückgängig machen.</strong>
        </p>
        <label className="block">
          <span className="field-label">Stichtag</span>
          <input
            type="date"
            className="field-input"
            value={before}
            max={todayInBerlin()}
            onChange={(e) => setBefore(e.target.value)}
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">Zur Bestätigung ANONYMISIEREN eintippen</span>
          <input
            className="field-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className={`${dangerBtn} mt-4`}
          disabled={busy || confirm !== 'ANONYMISIEREN' || !before}
          onClick={() => void run()}
        >
          {busy ? 'Läuft …' : 'Jetzt anonymisieren'}
        </button>
        {msg && (
          <div className="mt-4">
            {msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>}
          </div>
        )}
      </Panel>
    </>
  );
}
