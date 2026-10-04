/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Setzt <meta name="robots" content="noindex"> für Vorschau- und Entwicklungs-Builds.
 * Sicherer Standard: indexiert wird nur, wenn VITE_NOINDEX ausdrücklich "false" ist (Live-Build).
 */
function noindex(enabled: boolean): Plugin {
  return {
    name: 'noindex',
    transformIndexHtml: () =>
      enabled
        ? [
            {
              tag: 'meta',
              attrs: { name: 'robots', content: 'noindex, nofollow' },
              injectTo: 'head',
            },
          ]
        : [],
  };
}

/**
 * Lädt Schriften, Hero-Foto und Glitzer-Textur für den sichtbaren Bereich vorab (verhindert Layout-Sprünge beim Schriftwechsel).
 */
function preloadFonts(patterns: RegExp[]): Plugin {
  return {
    name: 'preload-fonts',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      const files = Object.keys(ctx.bundle ?? {});
      const fonts = files
        .filter((f) => patterns.some((p) => p.test(f)))
        .map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `/${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head' as const,
        }));
      // Hero-Foto (größtes sichtbares Element) und Glitzer-Band früh laden
      const hero800 = files.find((f) => /hero-800-.*\.webp$/.test(f));
      const hero1200 = files.find((f) => /hero-1200-.*\.webp$/.test(f));
      const glitter = files.find((f) => /gold-glitzer-.*\.webp$/.test(f));
      const images = [
        ...(hero800 && hero1200
          ? [
              {
                tag: 'link',
                attrs: {
                  rel: 'preload',
                  as: 'image',
                  type: 'image/webp',
                  imagesrcset: `/${hero800} 800w, /${hero1200} 1200w`,
                  imagesizes: '100vw',
                  fetchpriority: 'high',
                },
                injectTo: 'head' as const,
              },
            ]
          : []),
        ...(glitter
          ? [
              {
                tag: 'link',
                attrs: { rel: 'preload', as: 'image', href: `/${glitter}` },
                injectTo: 'head' as const,
              },
            ]
          : []),
      ];
      return [...fonts, ...images];
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vorschau-Build (npm run build:preview): eine einzige HTML-Datei mit Beispieldaten, z. B. für ein Artifact.
  const vorschau = mode === 'vorschau';
  if (vorschau) process.env.VITE_DEMO = 'true';
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // Für absolute URLs in index.html (og:image). Ohne Angabe relativ.
  process.env.VITE_PUBLIC_SITE_URL ??= env.VITE_PUBLIC_SITE_URL ?? '';
  return {
    plugins: [
      react(),
      tailwindcss(),
      noindex(env.VITE_NOINDEX !== 'false'),
      preloadFonts([
        /jost-latin-500-normal-.*\.woff2$/,
        /manrope-latin-400-normal-.*\.woff2$/,
        /manrope-latin-600-normal-.*\.woff2$/,
      ]),
      ...(vorschau ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, host: '127.0.0.1' },
    build: vorschau
      ? { target: 'es2022', outDir: 'dist-vorschau', assetsInlineLimit: 100_000_000 }
      : { target: 'es2022', sourcemap: false },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
});
