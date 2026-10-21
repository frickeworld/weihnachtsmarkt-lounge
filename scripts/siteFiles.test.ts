import { describe, expect, it } from 'vitest';
import { basePath, contentSecurityPolicy, htaccess, robotsTxt, sitemapXml } from './siteFiles';

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
    expect(h).toContain('RewriteRule ^ /index.html [L]');
    expect(h).toContain('Strict-Transport-Security');
    expect(h).toContain('admin|haendler|scan|ticket|buchung|newsletter|login');
    expect(h).not.toMatch(/^\s+Header always set X-Robots-Tag "noindex, nofollow"\n\s+<If/m);
  });
});

describe('Unterordner neben WordPress (/lounge)', () => {
  it('basePath aus PUBLIC_SITE_URL', () => {
    expect(basePath('')).toBe('/');
    expect(basePath('https://lounge.example')).toBe('/');
    expect(basePath('https://weihnachtsmarkt-detmold.de/lounge')).toBe('/lounge/');
    expect(basePath('https://weihnachtsmarkt-detmold.de/lounge/')).toBe('/lounge/');
  });
  it('.htaccess: RewriteBase, Fallback und noindex mit Präfix, kein HSTS für die ganze Domain', () => {
    const h = htaccess('https://abc.supabase.co', false, '/lounge/');
    expect(h).toContain('RewriteBase /lounge/');
    expect(h).toContain('RewriteRule ^ /lounge/index.html [L]');
    expect(h).toContain('m#^/lounge/(admin|haendler|scan|ticket|buchung|newsletter|login)(/|$)#');
    expect(h).not.toContain('Strict-Transport-Security');
  });
  it('robots.txt und Sitemap mit Präfix', () => {
    const r = robotsTxt('https://weihnachtsmarkt-detmold.de/lounge', false);
    expect(r).toContain('Disallow: /lounge/admin\n');
    expect(r).toContain('Sitemap: https://weihnachtsmarkt-detmold.de/lounge/sitemap.xml');
    expect(robotsTxt('https://weihnachtsmarkt-detmold.de/lounge', true)).toBe(
      'User-agent: *\nDisallow: /lounge/\n',
    );
    const x = sitemapXml('https://weihnachtsmarkt-detmold.de/lounge', '2026-10-21');
    expect(x).toContain('<loc>https://weihnachtsmarkt-detmold.de/lounge/</loc>');
    expect(x).toContain('<loc>https://weihnachtsmarkt-detmold.de/lounge/gewinnspiel</loc>');
  });
});
