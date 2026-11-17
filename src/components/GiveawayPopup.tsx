import { useEffect, useRef, useState } from 'react';
import taler192 from '@/assets/taler-192.webp';
import { GiveawayCountdown } from '@/components/GiveawayCountdown';
import { GiveawayJoinForm } from '@/components/GiveawayJoinForm';
import { GlitterBand } from '@/components/GlitterBand';
import { formatDrawTime } from '@/lib/drawCountdown';
import { maxTalerCount } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { useGiveawayInfo } from '@/lib/useGiveawayInfo';

/** Nach so vielen Millisekunden auf der Startseite erscheint das Pop-up (Entscheidung Louis, 16.11.2026). */
export const POPUP_DELAY_MS = 5000;
const SEEN_KEY = 'gewinnspiel-popup';

/** Nur einmal je Browser-Sitzung – kein Tracking, nur ein Merker in diesem Tab. */
function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Ohne Speicher erscheint das Pop-up beim nächsten Laden eben noch einmal.
  }
}

/** Nicht stören, wenn jemand gezielt bucht oder gerade etwas eintippt. */
function busyBooking(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') || params.has('abbruch')) return true;
  if (window.location.hash === '#buchen') return true;
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

/**
 * Pop-up „Jetzt Lounge gewinnen“ auf der Startseite: nach 5 Sekunden, nur wenn das Gewinnspiel
 * läuft, höchstens einmal pro Sitzung. Direkt eintragen mit demselben Formular wie /gewinnspiel.
 */
export function GiveawayPopup() {
  const info = useGiveawayInfo();
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!info?.active || alreadySeen()) return;
    const t = window.setTimeout(() => {
      if (busyBooking()) return;
      lastFocus.current = document.activeElement;
      markSeen();
      setOpen(true);
    }, POPUP_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [info?.active]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      // Fokus im Dialog halten
      if (e.key === 'Tab' && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([tabindex="-1"]), [tabindex="0"]',
        );
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open || !info) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gewinnspiel-popup-titel"
        tabIndex={-1}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface shadow-2xl outline-none motion-safe:animate-[popup-in_350ms_ease-out] sm:rounded-3xl"
      >
        <GlitterBand soft className="px-5 pt-5 pb-4 text-ink sm:px-8 sm:pt-6 sm:pb-5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute -top-1 -right-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-2xl leading-none text-ink shadow"
            aria-label="Schließen"
          >
            ×
          </button>
          <div className="flex items-center gap-4 pr-12">
            <img
              src={taler192}
              alt=""
              width={72}
              height={72}
              className="h-14 w-14 shrink-0 drop-shadow-lg sm:h-[72px] sm:w-[72px]"
            />
            <div>
              <p className="text-xs font-bold tracking-[0.2em] uppercase">Gewinnspiel</p>
              <h2
                id="gewinnspiel-popup-titel"
                className="font-display mt-1 text-2xl leading-tight font-medium sm:text-3xl"
              >
                Jetzt Lounge gewinnen
              </h2>
            </div>
          </div>
          <p className="mt-3 text-sm font-medium sm:text-base">
            Jede Woche verlosen wir einen Abend in unserer Lounge – für dich und bis zu{' '}
            {s.maxPersons - 1} Gäste, mit bis zu {maxTalerCount(s)} € Freiverzehr. Schnell
            eintragen!
          </p>
          {info.nextDrawAt && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">
                Nächste Ziehung: {formatDrawTime(info.nextDrawAt)}
              </p>
              <GiveawayCountdown target={info.nextDrawAt} />
            </div>
          )}
        </GlitterBand>
        <div className="px-5 py-5 sm:px-8 sm:py-6">
          <GiveawayJoinForm idPrefix="gwp" heading={null} showCompany={false} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 min-h-11 w-full text-sm text-ink-soft underline underline-offset-4"
          >
            Nein danke, weiter zur Lounge
          </button>
        </div>
      </div>
    </div>
  );
}
