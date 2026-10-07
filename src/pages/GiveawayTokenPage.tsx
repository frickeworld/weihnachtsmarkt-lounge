import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Footer } from '@/components/Footer';
import { GlitterBand } from '@/components/GlitterBand';
import { Header } from '@/components/Header';
import { giveawayAction, type GiveawayResult } from '@/lib/api';
import { whatsappUrl } from '@/lib/invite';
import { useNoindex } from '@/lib/useNoindex';

/**
 * /gewinnspiel/bestaetigt?token=… (Double-Opt-in) und /gewinnspiel/abmelden?token=…
 * Nach der Bestätigung: Freunde-Link zum Teilen (Extra-Los).
 */
export function GiveawayTokenPage({ mode }: { mode: 'confirm' | 'unsubscribe' }) {
  useNoindex();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [result, setResult] = useState<GiveawayResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title =
      mode === 'confirm' ? 'Teilnahme bestätigt – Gewinnspiel' : 'Abgemeldet – Gewinnspiel';
    let active = true;
    void giveawayAction({ action: mode, token }).then((r) => active && setResult(r));
    return () => {
      active = false;
    };
  }, [mode, token]);

  const shareUrl = result?.ok ? result.shareUrl : undefined;
  const shareText = shareUrl
    ? `Jede Woche einen Abend in der Lounge auf dem Weihnachtsmarkt im Schlosspark gewinnen – mach mit: ${shareUrl}`
    : '';

  return (
    <>
      <Header home={false} />
      <GlitterBand className="h-3" />
      <main className="min-h-[60vh] px-4 pt-6 pb-20 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          {!result && (
            <p role="status" className="mt-16 text-lg text-ink-soft">
              Einen Moment …
            </p>
          )}
          {result && !result.ok && (
            <div role="alert" className="mt-10">
              <h1 className="text-4xl font-medium">Das hat nicht geklappt</h1>
              <p className="mt-6 text-lg text-ink-soft">{result.message}</p>
              <Link to="/gewinnspiel" className="btn-outline mt-8">
                Zum Gewinnspiel
              </Link>
            </div>
          )}
          {result?.ok && mode === 'unsubscribe' && (
            <div role="status" className="mt-10">
              <h1 className="text-4xl font-medium">Du bist abgemeldet</h1>
              <p className="mt-6 text-lg text-ink-soft">
                Du nimmst nicht mehr an den Ziehungen teil und bekommst keine Gewinnspiel-Mails
                mehr. Vom Newsletter meldest du dich über den Link im Newsletter ab.
              </p>
              <Link to="/" className="btn-outline mt-8">
                Zur Startseite
              </Link>
            </div>
          )}
          {result?.ok && mode === 'confirm' && (
            <div role="status" className="mt-10">
              <p className="eyebrow mb-4">Teilnahme bestätigt</p>
              <h1 className="text-4xl leading-tight font-medium sm:text-5xl">
                Du bist im Lostopf{result.firstName ? `, ${result.firstName}` : ''}!
              </h1>
              <p className="mt-6 text-lg text-ink-soft">
                Jeden Montag ziehen wir einen Gewinner. Wir melden uns per E-Mail – auch wenn es
                diesmal nicht klappt, mit einem persönlichen Code für deinen Lounge-Abend.
              </p>
              {shareUrl && (
                <div className="mt-10 rounded-2xl border border-line bg-sand/60 p-5 text-left">
                  <p className="font-semibold">Extra-Los: Lade Freunde ein</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Für jeden, der über deinen Link mitmacht und bestätigt, bekommst du ein
                    zusätzliches Los.
                  </p>
                  <p className="mt-3 rounded-lg bg-surface px-3 py-2 font-mono text-sm break-all">
                    {shareUrl}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <a
                      href={whatsappUrl(shareText)}
                      target="_blank"
                      rel="noopener"
                      className="btn-outline w-full sm:w-auto"
                    >
                      Per WhatsApp teilen
                    </a>
                    <button
                      type="button"
                      className="btn-outline w-full sm:w-auto"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(shareUrl)
                          .then(() => setCopied(true))
                          .catch(() => setCopied(false))
                      }
                    >
                      {copied ? 'Kopiert' : 'Link kopieren'}
                    </button>
                  </div>
                </div>
              )}
              <Link to="/#buchen" className="btn-gold mt-10">
                Lounge buchen
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
