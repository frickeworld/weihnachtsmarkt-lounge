/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

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
 * Lädt die Schriften für den sichtbaren Hero-Bereich vorab (verhindert Layout-Sprünge beim Schriftwechsel).
 */
function preloadFonts(patterns: RegExp[]): Plugin {
  return {
    name: 'preload-fonts',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      const files = Object.keys(ctx.bundle ?? {}).filter((f) => patterns.some((p) => p.test(f)));
      return files.map((f) => ({
        tag: 'link',
        attrs: { rel: 'preload', href: `/${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
        injectTo: 'head' as const,
      }));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [
      react(),
      tailwindcss(),
      noindex(env.VITE_NOINDEX !== 'false'),
      preloadFonts([
        /cormorant-garamond-latin-600-normal-.*\.woff2$/,
        /manrope-latin-400-normal-.*\.woff2$/,
        /manrope-latin-600-normal-.*\.woff2$/,
      ]),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, host: '127.0.0.1' },
    build: { target: 'es2022', sourcemap: false },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
});
