import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, htaccess, robotsTxt, sitemapXml } from './siteFiles';

describe('robots.txt / sitemap.xml', () => {
  it('Vorschau: alles gesperrt', () => {
    expect(robotsTxt('https://lounge.example', true)).toBe('User-agent: *\nDisallow: /\n');
  });
  it('Live: interne Bereiche gesperrt, Sitemap verlinkt', () => {
    const r = robotsTxt('https://lounge.example/', false);
    for (const p of [
      '/admin',
      '/haendler',
      '/scan',
      '/ticket',
      '/buchung',
      '/newsletter',
      '/login',
    ])
      expect(r).toContain(`Disallow: ${p}\n`);
    expect(r).toContain('Sitemap: https://lounge.example/sitemap.xml');
  });
  it('Sitemap nur mit öffentlichen Seiten', () => {
    const x = sitemapXml('https://lounge.example', '2026-10-05');
    expect(x).toContain('<loc>https://lounge.example/</loc>');
    expect(x).toContain('<loc>https://lounge.example/agb</loc>');
    expect(x).not.toContain('admin');
  });
});

describe('Sicherheits-Header', () => {
  it('CSP erlaubt nur die eigene Supabase-Instanz', () => {
    const csp = contentSecurityPolicy('https://abc.supabase.co');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
  });
  it('.htaccess mit SPA-Fallback und noindex für interne Bereiche', () => {
    const h = htaccess('https://abc.supabase.co', false);
    expect(h).toContain('RewriteRule ^ index.html [L]');
    expect(h).toContain('admin|haendler|scan|ticket|buchung|newsletter|login');
    expect(h).not.toMatch(/^\s+Header always set X-Robots-Tag "noindex, nofollow"\n\s+<If/m);
  });
});
