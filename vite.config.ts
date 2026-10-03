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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), noindex(env.VITE_NOINDEX !== 'false')],
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
