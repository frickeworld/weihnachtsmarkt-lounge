import { expect, test } from '@playwright/test';
import { contentSecurityPolicy } from '../../scripts/siteFiles';
import { mockSupabase } from './support/mockSupabase';

test('CSP: keine Verstöße auf Startseite, Ticket, Login und Scanner', async ({ page }) => {
  const violations: string[] = [];
  page.on(
    'console',
    (m) => /Content Security Policy|Refused to/.test(m.text()) && violations.push(m.text()),
  );
  await mockSupabase(page, {
    ticket: {
      first_name: 'A',
      booking_code: 'HL-AAAA-AAAA',
      slot_date: '2026-12-05',
      start_time: '17:30:00',
      end_time: '19:30:00',
      persons: 2,
      status: 'paid',
      checked_in_at: null,
    },
  });
  await page.route('http://127.0.0.1:4173/**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      headers: {
        ...res.headers(),
        'content-security-policy': contentSecurityPolicy('http://supabase.test'),
      },
    });
  });
  for (const path of ['/', '/ticket/Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z', '/login', '/scan', '/agb']) {
    await page.goto(path);
    await page.waitForTimeout(1500);
  }
  await page.goto('/');
  await page.locator('#kontakt').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  expect(await page.locator('script[type="application/ld+json"]').count()).toBe(1);
  expect(violations).toEqual([]);
});
