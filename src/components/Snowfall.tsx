import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/useMediaQuery';

interface Flake {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
  alpha: number;
  gold: boolean;
}

/**
 * Schneefall auf einem einzigen Canvas, begrenzt auf den umgebenden Bereich (Hero).
 * ca. 70 Flocken mobil, 140 auf dem Desktop. Pausiert bei verstecktem Tab, aus bei „Bewegung reduzieren“.
 */
export function Snowfall({ gold = 'none' }: { gold?: 'none' | 'stars' | 'sparkle' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    let raf = 0;
    let last = performance.now();

    const makeFlake = (randomY: boolean): Flake => ({
      x: Math.random() * width,
      y: randomY ? Math.random() * height : -10,
      r: 0.7 + Math.random() * 2.1,
      speed: 18 + Math.random() * 42,
      drift: 8 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.35 + Math.random() * 0.5,
      // An besonderen Tagen fällt ein Teil als goldene Sterne bzw. Funken
      gold: gold !== 'none' && Math.random() < 0.22,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.parentElement!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = width < 768 ? 60 : 110;
      flakes = Array.from({ length: count }, (_, i) => flakes[i] ?? makeFlake(true));
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fffaf0';
      for (const f of flakes) {
        f.phase += dt * 0.8;
        f.y += f.speed * dt;
        f.x += Math.sin(f.phase) * f.drift * dt;
        if (f.y > height + 10 || f.x < -20 || f.x > width + 20) Object.assign(f, makeFlake(false));
        ctx.globalAlpha = f.alpha;
        if (f.gold) {
          drawStar(ctx, f.x, f.y, gold === 'stars' ? f.r * 2.6 : f.r * 1.8, f.phase);
          ctx.fillStyle = '#fffaf0';
          continue;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced, gold]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}

/** Goldener fünfzackiger Stern, dreht sich langsam mit `phase`. */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(phase * 0.6);
  ctx.fillStyle = '#E8C979';
  ctx.globalAlpha = Math.min(ctx.globalAlpha + 0.3, 1);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
