import { GiveawayCountdown } from '@/components/GiveawayCountdown';
import { formatDrawTime } from '@/lib/drawCountdown';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import taler192 from '@/assets/taler-192.webp';
import { Footer } from '@/components/Footer';
import { GlitterBand } from '@/components/GlitterBand';
import { Header } from '@/components/Header';
import { IconCheck } from '@/components/Icons';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/content/partners';
import { GiveawayJoinForm } from '@/components/GiveawayJoinForm';
import { fetchGiveawayInfo, type GiveawayInfo } from '@/lib/api';
import { formatLongDate } from '@/lib/dates';
import { maxTalerCount } from '@/lib/settings';
import { trackPageView } from '@/lib/track';
import { useSettings } from '@/lib/settingsContext';

/** /gewinnspiel – „Jede Woche einen Abend in der Lounge gewinnen“. */
export function GiveawayPage() {
  const s = useSettings();
  const [params] = useSearchParams();
  const ref = (params.get('ref') ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  const [info, setInfo] = useState<GiveawayInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => trackPageView('gewinnspiel'), []);
  useEffect(() => {
    document.title = 'Gewinnspiel: Jede Woche einen Lounge-Abend gewinnen – Die Händler';
    let active = true;
    void fetchGiveawayInfo().then((i) => {
      if (!active) return;
      setInfo(i);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const active = info?.active ?? false;

  return (
    <>
      <Header home={false} giveaway={false} />
      <GlitterBand className="h-3" />
      <main className="px-4 pt-10 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <p className="eyebrow mb-3">Gewinnspiel der Händler</p>
            <h1 className="text-4xl leading-tight font-medium sm:text-6xl">
              Jede Woche eine Lounge gewinnen
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              Erste Ziehung am Samstag, 28. November, um 20 Uhr – danach verlosen wir jeden Sonntag
              um 18 Uhr automatisch einen Abend in unserer Lounge auf dem Weihnachtsmarkt im
              Schlosspark – für dich und bis zu {s.maxPersons - 1} Gäste, mit bis zu{' '}
              {maxTalerCount(s)} € Freiverzehr und Tischservice. Einmal anmelden, und du bist bei
              allen Ziehungen bis zum Ende der Aktion dabei.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                'Einmal mitmachen – jede Woche neue Chance',
                'Gewinner suchen sich einen freien Abend selbst aus',
                `Ein ganzer Abend für bis zu ${s.maxPersons} Personen – mit Freiverzehr und Tischservice`,
                'Freunde einladen = Extra-Los für dich',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <IconCheck className="mt-1 h-5 w-5 shrink-0 text-gold-deep" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            {info && active && (
              <div className="mt-8 flex flex-wrap items-end gap-3">
                <div className="card px-5 py-3">
                  <div className="text-xs text-ink-soft">Nächste Ziehung</div>
                  <div className="font-display text-xl font-medium">
                    {info.nextDrawAt
                      ? formatDrawTime(info.nextDrawAt)
                      : formatLongDate(info.nextDraw)}
                  </div>
                  {info.nextDrawAt && (
                    <div className="mt-3">
                      <GiveawayCountdown target={info.nextDrawAt} tone="dark" />
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="mt-8 text-sm text-ink-soft">
              Folge{' '}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gold-deep underline underline-offset-4"
              >
                {INSTAGRAM_HANDLE}
              </a>{' '}
              – dort zeigen wir jede Woche, wie es in der Lounge aussieht.
            </p>
          </div>

          <div className="card relative overflow-hidden p-6 sm:p-8">
            <img
              src={taler192}
              alt=""
              width={96}
              height={96}
              className="absolute -top-4 -right-4 h-24 w-24 rotate-12 opacity-90"
            />
            {!loaded && <p className="text-ink-soft">Einen Moment …</p>}
            {loaded && !active && (
              <div role="status">
                <h2 className="text-2xl font-medium">Das Gewinnspiel ist gerade nicht aktiv.</h2>
                <p className="mt-3 text-ink-soft">
                  Schau bald wieder vorbei – oder sichere dir direkt einen Abend.
                </p>
                <Link to="/#buchen" className="btn-gold mt-6">
                  Lounge buchen
                </Link>
              </div>
            )}
            {loaded && active && <GiveawayJoinForm referral={ref || undefined} />}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
