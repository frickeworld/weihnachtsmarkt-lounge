import { useEffect, useState } from 'react';
import { fetchWalletInfo, ticketFileUrl } from '@/lib/api';
import { DEMO } from '@/lib/demo';

/**
 * PDF-Download und Wallet-Buttons zum Ticket. Wallet-Buttons erscheinen erst, wenn die
 * Zugangsdaten bei Apple bzw. Google hinterlegt sind.
 */
export function TicketDownloads({ token }: { token: string }) {
  const [wallet, setWallet] = useState({ apple: false, google: false });

  useEffect(() => {
    let active = true;
    void fetchWalletInfo().then((w) => active && setWallet(w));
    return () => {
      active = false;
    };
  }, []);

  if (DEMO) {
    return (
      <p className="mt-6 text-sm text-ink-soft">
        In der Vorschau gibt es keinen PDF-Download. Im Livebetrieb stehen hier „Ticket als PDF
        herunterladen“, „In den Kalender eintragen“ und – sobald eingerichtet – die Buttons für
        Apple und Google Wallet.
      </p>
    );
  }

  const walletBtn =
    'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep';

  return (
    <div className="mt-6 flex w-full flex-col gap-3" aria-label="Ticket speichern">
      <a href={ticketFileUrl(token, 'pdf')} className="btn-outline w-full" download>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
        </svg>
        Ticket als PDF herunterladen
      </a>
      <a href={ticketFileUrl(token, 'ics')} className="btn-outline w-full" download>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4" />
        </svg>
        In den Kalender eintragen
      </a>
      {wallet.apple && (
        <a href={ticketFileUrl(token, 'apple')} className={walletBtn}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8ZM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3Z" />
          </svg>
          Zu Apple Wallet hinzufügen
        </a>
      )}
      {wallet.google && (
        <a href={ticketFileUrl(token, 'google')} className={walletBtn}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="6" width="18" height="13" rx="2.5" />
            <path d="M3 10h18" />
          </svg>
          In Google Wallet speichern
        </a>
      )}
    </div>
  );
}
