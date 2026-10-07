import type { Plugin } from 'vite';

/** Interne Bereiche: nie indexieren (zusätzlich zu <meta robots> in der App). */
export const PRIVATE_PATHS = [
  '/admin',
  '/haendler',
  '/scan',
  '/ticket',
  '/buchung',
  '/newsletter',
  '/login',
];
export const PUBLIC_PATHS = [
  '/',
  '/gewinnspiel',
  '/gewinnspiel/teilnahmebedingungen',
  '/impressum',
  '/datenschutz',
  '/agb',
];

export function robotsTxt(siteUrl: string, noindex: boolean): string {
  if (noindex) return 'User-agent: *\nDisallow: /\n';
  const base = siteUrl.replace(/\/$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(siteUrl: string, lastmod: string): string {
  const base = siteUrl.replace(/\/$/, '');
  const urls = PUBLIC_PATHS.map(
    (p) =>
      `  <url><loc>${base}${p === '/' ? '/' : p}</loc><lastmod>${lastmod}</lastmod><priority>${p === '/' ? '1.0' : '0.3'}</priority></url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Content-Security-Policy: nur eigene Skripte; Daten nur von der eigenen Supabase-Instanz. */
export function contentSecurityPolicy(supabaseUrl: string): string {
  const sb = supabaseUrl ? new URL(supabaseUrl).origin : '';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${sb}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${sb}`.trim(),
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Apache/Mittwald: SPA-Fallback, Caching, Sicherheits-Header, noindex für interne Bereiche. */
export function htaccess(supabaseUrl: string, noindex: boolean): string {
  const privateRegex = PRIVATE_PATHS.map((p) => p.slice(1)).join('|');
  return `# Erzeugt beim Build (scripts/siteFiles.ts) – nicht von Hand ändern.
Options -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  # HTTPS erzwingen
  RewriteCond %{HTTPS} !=on
  RewriteCond %{HTTP:X-Forwarded-Proto} !=https
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  # Single-Page-App: unbekannte Pfade an index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_headers.c>
  Header always set Content-Security-Policy "${contentSecurityPolicy(supabaseUrl)}"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=()"
  Header always set Strict-Transport-Security "max-age=31536000"
  Header always set X-Frame-Options "DENY"
${noindex ? '  Header always set X-Robots-Tag "noindex, nofollow"\n' : ''}  <If "%{REQUEST_URI} =~ m#^/(${privateRegex})(/|$)#">
    Header always set X-Robots-Tag "noindex, nofollow"
  </If>
  # Gehashte Dateien dürfen lange im Cache bleiben, index.html nie
  <FilesMatch "\\.(js|css|woff2|webp|avif|png|jpg|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "^(index\\.html|robots\\.txt|sitemap\\.xml)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml application/xml text/plain
</IfModule>
`;
}

/** Cloudflare Pages (Vorschau): gleiche Header, immer noindex. */
export function cloudflareHeaders(supabaseUrl: string): string {
  return `/*
  Content-Security-Policy: ${contentSecurityPolicy(supabaseUrl)}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()
  X-Frame-Options: DENY
  X-Robots-Tag: noindex, nofollow

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

export function siteFiles(opts: {
  siteUrl: string;
  supabaseUrl: string;
  noindex: boolean;
}): Plugin {
  return {
    name: 'site-files',
    apply: 'build',
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const emit = (fileName: string, source: string) =>
        this.emitFile({ type: 'asset', fileName, source });
      emit('robots.txt', robotsTxt(opts.siteUrl, opts.noindex || !opts.siteUrl));
      if (opts.siteUrl) emit('sitemap.xml', sitemapXml(opts.siteUrl, today));
      emit('.htaccess', htaccess(opts.supabaseUrl, opts.noindex));
      emit('_headers', cloudflareHeaders(opts.supabaseUrl));
    },
  };
}
