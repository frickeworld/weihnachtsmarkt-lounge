import { useEffect, useRef } from 'react';
import taler192 from '@/assets/taler-192.webp';
import { usePrefersReducedMotion } from '@/lib/useMediaQuery';

interface Coin {
  x: number;
  y: number;
  size: number;
  vy: number;
  vx: number;
  spin: number;
  phase: number;
  delay: number;
}

interface Sparkle {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

const DURATION_MS = 5200;

/**
 * Taler-Regen: Weihnachtsmarkt-Taler fallen einmal über den ganzen Bildschirm, drehen sich und
 * funkeln. Läuft bei jeder Änderung von `play` erneut. Bei „Bewegung reduzieren“ passiert nichts.
 */
export function TalerRain({ play }: { play: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || play === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.src = taler192;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = width < 768 ? 28 : 46;
    const coins: Coin[] = Array.from({ length: count }, () => {
      const size = 30 + Math.random() * 34;
      return {
        x: Math.random() * width,
        y: -size - Math.random() * 80,
        size,
        vy: 140 + Math.random() * 160,
        vx: (Math.random() - 0.5) * 40,
        spin: 3 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 1600,
      };
    });
    const sparkles: Sparkle[] = [];

    let raf = 0;
    const start = performance.now();
    let last = start;

    const frame = (now: number) => {
      const elapsed = now - start;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      // Gegen Ende sanft ausblenden
      ctx.globalAlpha =
        elapsed > DURATION_MS - 900 ? Math.max((DURATION_MS - elapsed) / 900, 0) : 1;

      for (const c of coins) {
        if (elapsed < c.delay) continue;
        c.vy += 220 * dt;
        c.y += c.vy * dt;
        c.x += c.vx * dt;
        c.phase += c.spin * dt;
        // Drehung um die senkrechte Achse: Breite schwankt mit cos(phase)
        const sx = Math.cos(c.phase);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(Math.max(Math.abs(sx), 0.08), 1);
        if (img.complete) ctx.drawImage(img, -c.size / 2, -c.size / 2, c.size, c.size);
        ctx.restore();
        // Aufblitzen, wenn die Münze frontal steht
        if (Math.abs(sx) > 0.985 && Math.random() < 0.25) {
          sparkles.push({
            x: c.x + c.size * 0.25,
            y: c.y - c.size * 0.25,
            r: 2 + Math.random() * 3,
            life: 0,
            max: 0.5,
          });
        }
      }

      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i]!;
        s.life += dt;
        if (s.life > s.max) {
          sparkles.splice(i, 1);
          continue;
        }
        const k = 1 - s.life / s.max;
        ctx.fillStyle = `rgba(255, 240, 200, ${k})`;
        ctx.beginPath();
        // Vierzackiger Stern
        const r = s.r * (1 + (1 - k));
        ctx.moveTo(s.x, s.y - r * 2);
        ctx.lineTo(s.x + r * 0.4, s.y - r * 0.4);
        ctx.lineTo(s.x + r * 2, s.y);
        ctx.lineTo(s.x + r * 0.4, s.y + r * 0.4);
        ctx.lineTo(s.x, s.y + r * 2);
        ctx.lineTo(s.x - r * 0.4, s.y + r * 0.4);
        ctx.lineTo(s.x - r * 2, s.y);
        ctx.lineTo(s.x - r * 0.4, s.y - r * 0.4);
        ctx.closePath();
        ctx.fill();
      }

      if (elapsed < DURATION_MS) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, width, height);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, height);
    };
  }, [play, reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"
    />
  );
}
