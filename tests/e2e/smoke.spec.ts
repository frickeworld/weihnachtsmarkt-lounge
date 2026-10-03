import { expect, test } from '@playwright/test';
import { mockSupabase } from './support/mockSupabase';

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
});

test('Startseite lädt mit Titel, Logo und ohne seitliches Scrollen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Lounge buchen – Weihnachtsmarkt im Schlosspark Detmold/);
  await expect(page.locator('#start').getByAltText(/Die Händler/)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('Vorschau-Build ist auf noindex gesetzt', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
