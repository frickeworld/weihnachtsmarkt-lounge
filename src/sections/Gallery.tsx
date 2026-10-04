import { useEffect, useRef, useState } from 'react';
import { SectionHeading } from '@/components/SectionHeading';
import { galleryPhotos, type GalleryPhoto } from '@/content/gallery';

/**
 * „So sieht die Lounge aus“: mobil zum Wischen, ab Tablet als Raster. Antippen öffnet das Foto
 * groß (Pfeiltasten und Wischen zum Blättern, Esc schließt). Ohne Fotos wird nichts angezeigt.
 */
export function Gallery({ photos = galleryPhotos }: { photos?: GalleryPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;

  return (
    <section id="einblicke" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Einblicke" title="So sieht die Lounge aus" />
        <ul
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3"
          aria-label="Fotos der Lounge"
        >
          {photos.map((p, i) => (
            <li key={p.name} className="w-[82%] shrink-0 snap-center sm:w-auto">
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="group block w-full overflow-hidden rounded-2xl border border-line bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
                aria-label={`Foto ${i + 1} von ${photos.length} groß anzeigen: ${p.alt}`}
              >
                <img
                  src={p.small}
                  srcSet={`${p.small} 800w, ${p.large} 1600w`}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 82vw"
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                />
              </button>
            </li>
          ))}
        </ul>
        {photos.length > 1 && (
          <p className="mt-3 text-center text-sm text-ink-soft sm:hidden" aria-hidden="true">
            Zum Blättern wischen
          </p>
        )}
      </div>
      {open !== null && (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const p = photos[index]!;
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`Foto ${index + 1} von ${photos.length}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined && Math.abs(end - start) > 50)
          go(end < start ? 1 : -1);
        touchX.current = null;
      }}
      className="m-auto h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-brown-deep/90"
    >
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <img
          src={p.large}
          alt={p.alt}
          className="max-h-[80vh] max-w-full rounded-xl object-contain"
        />
        <div className="on-dark flex items-center gap-3 text-on-dark">
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => go(-1)}
              className="btn-outline !min-h-11 !px-4"
              aria-label="Vorheriges Foto"
            >
              ←
            </button>
          )}
          <span className="min-w-16 text-center text-sm tabular-nums">
            {index + 1} / {photos.length}
          </span>
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => go(1)}
              className="btn-outline !min-h-11 !px-4"
              aria-label="Nächstes Foto"
            >
              →
            </button>
          )}
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="btn-outline !min-h-11 !px-4"
          >
            Schließen
          </button>
        </div>
      </div>
    </dialog>
  );
}
