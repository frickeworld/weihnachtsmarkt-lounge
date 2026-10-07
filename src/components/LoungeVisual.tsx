/**
 * KI-generiertes Bild der Lounge (bis echte Fotos da sind). Die Dateien erzeugt
 * scripts/build-images.mjs aus assets/lounge-ki. Ohne Bild wird nichts angezeigt.
 */
const files = import.meta.glob<string>('../assets/lounge-ki/lounge-ki-*.{webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
});
const pick = (w: number, ext: string) =>
  Object.entries(files).find(([p]) => p.endsWith(`lounge-ki-${w}.${ext}`))?.[1];

export function LoungeVisual() {
  const small = pick(1000, 'webp');
  const large = pick(1800, 'webp');
  if (!small || !large) return null;
  const avifSmall = pick(1000, 'avif');
  const avifLarge = pick(1800, 'avif');
  return (
    <figure className="mb-8 overflow-hidden rounded-[28px] shadow-[0_30px_60px_-40px_rgba(36,34,30,0.7)] sm:mb-12">
      <picture>
        {avifSmall && avifLarge && (
          <source
            type="image/avif"
            srcSet={`${avifSmall} 1000w, ${avifLarge} 1800w`}
            sizes="(min-width: 1152px) 1152px, 100vw"
          />
        )}
        <img
          src={large}
          srcSet={`${small} 1000w, ${large} 1800w`}
          sizes="(min-width: 1152px) 1152px, 100vw"
          width={1800}
          height={1013}
          loading="lazy"
          decoding="async"
          alt="Die Lounge der Händler: beleuchtete Holzhütte auf dem Weihnachtsmarkt mit langer Tafel und warmem Licht"
          className="block aspect-video w-full object-cover"
        />
      </picture>
      <figcaption className="bg-brown px-4 py-2 text-right text-[11px] text-on-dark/80">
        KI-generierte Visualisierung – die echte Lounge kann abweichen
      </figcaption>
    </figure>
  );
}
