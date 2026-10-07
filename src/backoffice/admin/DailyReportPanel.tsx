import { useState, type FormEvent } from 'react';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, Panel, SuccessBox } from '../ui';
import { unwrap, useLoad } from './useLoad';

/** Empfänger des Tagesberichts (7:45 Uhr): immer die Kontakt-E-Mail, dazu diese Adressen. */
export function DailyReportPanel() {
  const data = useLoad(
    async () =>
      unwrap(
        await requireClient()
          .from('settings')
          .select('contact_email, daily_report_recipients')
          .eq('id', 1)
          .single(),
      ) as { contact_email: string; daily_report_recipients: string[] },
    [],
  );
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = value ?? (data.data?.daily_report_recipients ?? []).join(', ');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const list = current
      .split(/[\s,;]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    const bad = list.find((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (bad) return setMsg({ ok: false, text: `Bitte prüfe die Adresse „${bad}“.` });
    setBusy(true);
    const { error } = await requireClient()
      .from('settings')
      .update({ daily_report_recipients: [...new Set(list)] })
      .eq('id', 1);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errorText(error) });
    setValue(null);
    setMsg({ ok: true, text: 'Gespeichert.' });
    data.reload();
  };

  return (
    <Panel title="Tagesbericht per E-Mail">
      {data.loading && !data.data && <Loading />}
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      <p className="mb-3 text-sm text-ink-soft">
        Jeden Morgen um 7:45 Uhr während der Saison: neue Buchungen von gestern, wer heute kommt
        (mit Wünschen), freie Termine der nächsten 7 Tage. Geht immer an{' '}
        <strong>{data.data?.contact_email ?? '…'}</strong>.
      </p>
      <form onSubmit={(e) => void save(e)} className="space-y-3">
        <label className="block">
          <span className="field-label">Weitere Empfänger (durch Komma getrennt)</span>
          <input
            className="field-input"
            value={current}
            placeholder="z. B. vorstand@die-haendler-detmold.de"
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {msg && (msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>)}
        <button type="submit" className="btn-outline" disabled={busy}>
          {busy ? 'Speichern …' : 'Speichern'}
        </button>
      </form>
    </Panel>
  );
}
