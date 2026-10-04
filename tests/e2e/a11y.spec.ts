import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login, mockBackoffice } from './support/mockBackoffice';
import { mockSupabase } from './support/mockSupabase';

// WCAG 2.1 AA automatisch prüfen (ersetzt keinen Test mit Screenreader, findet aber die meisten Fehler).
const pages = ['/', '/impressum', '/datenschutz', '/agb', '/login', '/scan', '/gibt-es-nicht'];

for (const path of pages) {
  test(`Barrierefreiheit (WCAG AA): ${path}`, async ({ page }) => {
    await mockSupabase(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    if (path === '/') {
      // Nachgeladene Bereiche (Kontaktformular) einblenden
      await page.locator('#kontakt').scrollIntoViewIfNeeded();
      await page.getByRole('form', { name: 'Kontaktformular' }).waitFor();
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    );
    expect(summary).toEqual([]);
  });
}

test('Barrierefreiheit (WCAG AA): Online-Ticket', async ({ page }) => {
  await mockSupabase(page, {
    ticket: {
      first_name: 'Anna',
      booking_code: 'HL-ABCD-EFGH',
      slot_date: '2026-12-05',
      start_time: '17:30:00',
      end_time: '19:30:00',
      persons: 8,
      status: 'paid',
      checked_in_at: null,
    },
  });
  await page.goto('/ticket/Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z');
  await page.getByText('Gültig').waitFor();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

for (const [role, path, wait] of [
  ['studio_admin', '/admin', 'Gebuchte Lounges'],
  ['studio_admin', '/admin/neue-buchung', 'Zeitfenster'],
  ['haendler', '/haendler/abrechnung', 'Summe (2 Buchungen)'],
] as const) {
  test(`Barrierefreiheit (WCAG AA): ${path}`, async ({ page }) => {
    await mockBackoffice(page, { role, hasFactor: role === 'studio_admin' });
    await page.goto(`/login?next=${encodeURIComponent(path)}`);
    await login(page);
    if (role === 'studio_admin') {
      await page.getByLabel('6-stelliger Code').fill('123456');
      await page.getByRole('button', { name: 'Bestätigen' }).click();
    }
    await page.getByText(wait).first().waitFor();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(
      r.violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 2)
            .join(' | ')}`,
      ),
    ).toEqual([]);
  });
}
