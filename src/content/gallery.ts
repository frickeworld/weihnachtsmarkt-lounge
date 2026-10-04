/**
 * Lounge-Fotos für die Galerie. Die Web-Versionen erzeugt scripts/build-images.mjs aus
 * assets/lounge-fotos (je 800 und 1600 px breit). Ohne Fotos bleibt die Galerie unsichtbar.
 */
export interface GalleryPhoto {
  name: string;
  small: string;
  large: string;
  alt: string;
}

/** Bildbeschreibungen je Dateiname (ohne -800/-1600.webp). */
export const ALT_TEXTS: Record<string, string> = {
  // '01-lounge-abends': 'Die beleuchtete Lounge-Hütte am Abend',
};

const DEFAULT_ALT = 'Die Lounge der Händler auf dem Weihnachtsmarkt im Schlosspark';

/** Gruppiert die erzeugten Dateien nach Foto und sortiert nach Dateiname. */
export function groupPhotos(files: Record<string, string>): GalleryPhoto[] {
  const byName = new Map<string, { small?: string; large?: string }>();
  for (const [path, url] of Object.entries(files)) {
    const m = /([^/]+)-(800|1600)\.webp$/.exec(path);
    if (!m) continue;
    const entry = byName.get(m[1]!) ?? {};
    if (m[2] === '800') entry.small = url;
    else entry.large = url;
    byName.set(m[1]!, entry);
  }
  return [...byName.entries()]
    .filter(([, e]) => e.small || e.large)
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([name, e]) => ({
      name,
      small: (e.small ?? e.large)!,
      large: (e.large ?? e.small)!,
      alt: ALT_TEXTS[name] ?? DEFAULT_ALT,
    }));
}

export const galleryPhotos: GalleryPhoto[] = groupPhotos(
  import.meta.glob<string>('../assets/lounge/*.webp', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
);
