import { useState } from 'react';
import { env } from '@/lib/env';
import { inviteText, whatsappUrl } from '@/lib/invite';

/** „Sag deiner Runde Bescheid“ – WhatsApp oder Teilen-Menü des Handys, sonst Text kopieren. */
export function InviteFriends({
  date,
  startTime,
  endTime,
}: {
  date: string;
  startTime: string;
  endTime: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = inviteText(date, startTime, endTime, env.publicSiteUrl);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = async () => {
    try {
      await navigator.share({ text });
    } catch {
      // abgebrochen – nichts tun
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-8 w-full rounded-2xl border border-line bg-sand/60 p-5 text-left">
      <p className="font-semibold">Sag deiner Runde Bescheid</p>
      <p className="mt-1 text-sm text-ink-soft">
        Schick Datum und Uhrzeit an alle, die mitkommen. Dein Ticket mit QR-Code behältst du.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={whatsappUrl(text)}
          target="_blank"
          rel="noopener"
          className="btn-outline w-full sm:w-auto"
        >
          Per WhatsApp einladen
        </a>
        {canShare ? (
          <button
            type="button"
            className="btn-outline w-full sm:w-auto"
            onClick={() => void share()}
          >
            Teilen …
          </button>
        ) : (
          <button
            type="button"
            className="btn-outline w-full sm:w-auto"
            onClick={() => void copy()}
          >
            {copied ? 'Kopiert' : 'Text kopieren'}
          </button>
        )}
      </div>
    </div>
  );
}
