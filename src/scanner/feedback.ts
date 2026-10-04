import type { ScanResultKind } from './types';

let ctx: AudioContext | null = null;

/** Muss einmal nach einer Berührung aufgerufen werden (Browser erlauben Ton erst danach). */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* kein Ton verfügbar */
  }
}

function beep(freq: number, start: number, duration: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

/** Ton und Vibration je Ergebnis: grün hell doppelt, gelb/orange mittel, rot tief und lang. */
export function signal(kind: ScanResultKind) {
  const pattern: Record<ScanResultKind, { tones: [number, number, number][]; vibrate: number[] }> =
    {
      ok: {
        tones: [
          [880, 0, 0.12],
          [1320, 0.14, 0.16],
        ],
        vibrate: [80],
      },
      override: {
        tones: [
          [880, 0, 0.12],
          [1320, 0.14, 0.16],
        ],
        vibrate: [80],
      },
      already: { tones: [[660, 0, 0.25]], vibrate: [80, 80, 80] },
      wrong_slot: {
        tones: [
          [520, 0, 0.18],
          [520, 0.24, 0.18],
        ],
        vibrate: [150, 80, 150],
      },
      invalid: { tones: [[220, 0, 0.6]], vibrate: [400] },
    };
  const p = pattern[kind];
  p.tones.forEach(([f, s, d]) => beep(f, s, d));
  try {
    navigator.vibrate?.(p.vibrate);
  } catch {
    /* nicht unterstützt (iPhone) */
  }
}
