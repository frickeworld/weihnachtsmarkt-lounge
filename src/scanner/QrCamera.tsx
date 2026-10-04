import { useEffect, useRef, useState } from 'react';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): BarcodeDetectorLike;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

/**
 * Rückkamera mit QR-Erkennung. Nutzt die eingebaute Erkennung (Android/Chrome), sonst jsQR
 * (iPhone). Taschenlampe, wenn das Gerät sie anbietet. `paused` hält die Erkennung an.
 */
export function QrCamera({ paused, onCode }: { paused: boolean; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement('canvas');
    const ctx2d = canvas.getContext('2d', { willReadFrequently: true });
    let last = { code: '', at: 0 };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'Dieses Gerät kann die Kamera im Browser nicht nutzen. Bitte den Code von Hand eingeben.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        setError(
          'Kein Zugriff auf die Kamera. Bitte in den Browser-Einstellungen erlauben oder den Code von Hand eingeben.',
        );
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      track.current = stream.getVideoTracks()[0] ?? null;
      const caps = (track.current?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorchAvailable(Boolean(caps.torch));

      // Eingebaute Erkennung nur, wenn sie QR wirklich kann (Chrome unter Linux/Windows meldet sie ohne Formate)
      let detector: BarcodeDetectorLike | null = null;
      try {
        const formats = (await window.BarcodeDetector?.getSupportedFormats?.()) ?? [];
        if (window.BarcodeDetector && formats.includes('qr_code'))
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
      const jsQR = (await import('jsqr')).default;

      const tick = async () => {
        if (stopped) return;
        if (!pausedRef.current && v.readyState >= 2 && v.videoWidth) {
          let code: string | null = null;
          try {
            if (detector) {
              code = (await detector.detect(v))[0]?.rawValue ?? null;
            } else if (ctx2d) {
              const scale = Math.min(1, 640 / v.videoWidth);
              canvas.width = Math.round(v.videoWidth * scale);
              canvas.height = Math.round(v.videoHeight * scale);
              ctx2d.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
              code =
                jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ??
                null;
            }
          } catch {
            detector = null; // eingebaute Erkennung streikt → jsQR
            code = null;
          }
          // Denselben Code nicht mehrfach hintereinander melden
          if (code && (code !== last.code || Date.now() - last.at > 3000)) {
            last = { code, at: Date.now() };
            onCodeRef.current(code);
          }
        }
        timer = setTimeout(() => void tick(), 120);
      };
      void tick();
    };
    void start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const next = !torch;
    try {
      await track.current?.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorch(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  if (error) {
    return (
      <div
        role="alert"
        className="flex aspect-square w-full items-center justify-center rounded-3xl bg-sand p-6 text-center text-ink"
      >
        {error}
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-brown">
      <video
        ref={video}
        muted
        playsInline
        className="h-full w-full object-cover"
        aria-label="Kamerabild zum Scannen"
      />
      {/* Zielrahmen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-gold-light/90 shadow-[0_0_0_9999px_rgba(20,19,17,0.35)]"
      />
      {torchAvailable && (
        <button
          type="button"
          onClick={() => void toggleTorch()}
          aria-pressed={torch}
          className="absolute right-3 bottom-3 min-h-12 rounded-full bg-black/60 px-4 text-sm font-semibold text-white"
        >
          {torch ? 'Licht aus' : 'Licht an'}
        </button>
      )}
    </div>
  );
}
