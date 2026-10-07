import { useState, type FormEvent } from 'react';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, Panel, SuccessBox } from '../ui';
import { formatDateTime } from './format';
import { unwrap, useLoad } from './useLoad';

interface Row {
  instagram_followers: number | null;
  instagram_followers_updated_at: string | null;
}

/**
 * Follower-Zahl von @diehaendlerdetmold für die Website. Wird automatisch aktualisiert, sobald
 * INSTAGRAM_USER_ID und INSTAGRAM_ACCESS_TOKEN gesetzt sind; bis dahin hier von Hand.
 */
export function InstagramPanel() {
  const data = useLoad(
    async () =>
      unwrap(
        await requireClient()
          .from('settings')
          .select('instagram_followers, instagram_followers_updated_at')
          .eq('id', 1)
          .single(),
      ) as Row,
    [],
  );
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const current = value ?? data.data?.instagram_followers?.toString() ?? '';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const trimmed = current.trim().replace(/\./g, '');
    if (trimmed && !/^\d{1,7}$/.test(trimmed))
      return setMsg({ ok: false, text: 'Bitte eine ganze Zahl angeben, z. B. 2480.' });
    setBusy(true);
    const { error } = await requireClient()
      .from('settings')
      .update({
        instagram_followers: trimmed ? Number(trimmed) : null,
        instagram_followers_updated_at: trimmed ? new Date().toISOString() : null,
      })
      .eq('id', 1);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: errorText(error) });
    setValue(null);
    setMsg({ ok: true, text: trimmed ? 'Gespeichert.' : 'Zähler ausgeblendet.' });
    data.reload();
  };

  return (
    <Panel title="Instagram-Follower">
      {data.loading && !data.data && <Loading />}
      {data.error != null && <ErrorBox>{errorText(data.error)}</ErrorBox>}
      <form onSubmit={(e) => void save(e)} className="space-y-3">
        <label className="block">
          <span className="field-label">Follower von @diehaendlerdetmold</span>
          <input
            className="field-input"
            inputMode="numeric"
            value={current}
            placeholder="leer = Zähler ausblenden"
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <p className="text-sm text-ink-soft">
          Stand: {formatDateTime(data.data?.instagram_followers_updated_at)}. Sobald die
          Instagram-Schnittstelle eingerichtet ist, aktualisiert sich die Zahl alle 6 Stunden
          selbst.
        </p>
        {msg && (msg.ok ? <SuccessBox>{msg.text}</SuccessBox> : <ErrorBox>{msg.text}</ErrorBox>)}
        <button type="submit" className="btn-outline" disabled={busy}>
          {busy ? 'Speichern …' : 'Speichern'}
        </button>
      </form>
    </Panel>
  );
}
