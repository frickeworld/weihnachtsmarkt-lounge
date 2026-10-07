import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/useMediaQuery';

/** Zählt beim ersten Sichtbarwerden von 0 auf `value` hoch (sofort bei „Bewegung reduzieren“). */
export function CountUp({ value, durationMs = 1600 }: { value: number; durationMs?: number }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / durationMs, 1);
        setShown(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, reduced, durationMs]);

  return (
    <span ref={ref} className="tabular-nums" aria-label={value.toLocaleString('de-DE')}>
      <span aria-hidden="true">{(reduced ? value : shown).toLocaleString('de-DE')}</span>
    </span>
  );
}
