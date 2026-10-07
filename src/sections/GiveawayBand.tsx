import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import taler192 from '@/assets/taler-192.webp';
import { GlitterBand } from '@/components/GlitterBand';
import { Reveal } from '@/components/Reveal';
import { fetchGiveawayInfo, type GiveawayInfo } from '@/lib/api';
import { formatLongDate } from '@/lib/dates';

/** Band „Jede Woche einen Abend gewinnen“ – nur sichtbar, solange das Gewinnspiel aktiv ist. */
export function GiveawayBand() {
  const [info, setInfo] = useState<GiveawayInfo | null>(null);
  useEffect(() => {
    let active = true;
    void fetchGiveawayInfo().then((i) => active && setInfo(i));
    return () => {
      active = false;
    };
  }, []);
  if (!info?.active) return null;

  return (
    <section aria-labelledby="gewinnspiel-band" className="px-4 py-10 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <GlitterBand soft className="rounded-[28px] px-6 py-8 sm:px-12 sm:py-10">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <img
              src={taler192}
              alt=""
              width={112}
              height={112}
              className="h-24 w-24 shrink-0 drop-shadow-lg motion-safe:animate-[taler-pop_900ms_ease-out] sm:h-28 sm:w-28"
            />
            <div className="flex-1">
              <p className="text-sm font-bold tracking-[0.2em] uppercase">Gewinnspiel</p>
              <h2
                id="gewinnspiel-band"
                className="font-display mt-1 text-3xl font-medium sm:text-4xl"
              >
                Jede Woche einen Abend in der Lounge gewinnen
              </h2>
              <p className="mt-2 font-medium">
                Nächste Ziehung: {formatLongDate(info.nextDraw)} · Einmal mitmachen, jede Woche
                dabei
              </p>
            </div>
            <Link
              to="/gewinnspiel"
              className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-brown px-7 font-semibold text-on-dark transition-transform hover:-translate-y-0.5"
            >
              Jetzt mitmachen
            </Link>
          </div>
        </GlitterBand>
      </Reveal>
    </section>
  );
}
