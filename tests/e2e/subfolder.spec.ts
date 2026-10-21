import { expect, test } from '@playwright/test';
import { mockSupabase } from './support/mockSupabase';

// Live liegt die Seite im Unterordner /lounge neben der WordPress-Seite des Weihnachtsmarkts.
// LOUNGE_BASE_URL erlaubt denselben Test gegen einen echten Apache (docs/STRATO.md).
const BASE = (process.env.LOUNGE_BASE_URL ?? 'http://127.0.0.1:4174/lounge').replace(/\/$/, '');
const PATH = new URL(BASE).pathname;

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
});

test('Unterordner: Startseite, Bilder und Links bleiben unter /lounge', async ({ page }) => {
  const broken: string[] = [];
  page.on('response', (r) => {
    if (r.url().startsWith(new URL(BASE).origin) && r.status() >= 400) broken.push(r.url());
  });
  await page.goto(`${BASE}/`);
  await expect(page).toHaveTitle(/Lounge buchen/);
  await expect(page.getByRole('banner').getByAltText(/Die Händler/)).toBeVisible();
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Kontakt' })).toHaveAttribute(
    'href',
    `${PATH}/#kontakt`,
  );
  await footer.getByRole('link', { name: 'Datenschutz' }).click();
  await expect(page).toHaveURL(`${BASE}/datenschutz`);
  expect(broken).toEqual([]);
});

test('Unterordner: Direktlinks funktionieren (AGB, Admin → Login)', async ({ page }) => {
  await page.goto(`${BASE}/agb`);
  await expect(
    page.getByRole('heading', { name: 'Allgemeine Geschäftsbedingungen' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Datenschutzerklärung' }).click();
  await expect(page).toHaveURL(`${BASE}/datenschutz`);
  await page.goto(`${BASE}/admin`);
  await expect(page).toHaveURL(`${BASE}/login?next=%2Fadmin`);
});
