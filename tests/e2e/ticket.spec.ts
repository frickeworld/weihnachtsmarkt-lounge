import { expect, test } from '@playwright/test';
import { mockSupabase } from './support/mockSupabase';

const TOKEN = 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z';
const ticket = {
  first_name: 'Anna',
  booking_code: 'HL-ABCD-EFGH',
  slot_date: '2026-12-05',
  start_time: '17:30:00',
  end_time: '19:30:00',
  persons: 8,
  status: 'paid',
  checked_in_at: null,
};

test.describe('Online-Ticket', () => {
  test('zeigt QR-Code, Code, Termin, Name, Personen und „Gültig“', async ({ page }) => {
    await mockSupabase(page, { ticket });
    await page.goto(`/ticket/${TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Samstag, 5. Dezember 2026' })).toBeVisible();
    await expect(page.getByText('17:30–19:30 Uhr')).toBeVisible();
    await expect(page.getByText('Gültig')).toBeVisible();
    await expect(page.getByText('HL-ABCD-EFGH')).toBeVisible();
    await expect(page.getByText('Anna')).toBeVisible();
    const qr = page.getByAltText('QR-Code für Buchung HL-ABCD-EFGH');
    await expect(qr).toBeVisible();
    expect(await qr.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });

  test('eingecheckt zeigt Uhrzeit', async ({ page }) => {
    await mockSupabase(page, { ticket: { ...ticket, checked_in_at: '2026-12-05T16:42:00Z' } });
    await page.goto(`/ticket/${TOKEN}`);
    await expect(page.getByText('Eingecheckt um 17:42 Uhr')).toBeVisible();
  });

  test('storniert', async ({ page }) => {
    await mockSupabase(page, { ticket: { ...ticket, status: 'cancelled' } });
    await page.goto(`/ticket/${TOKEN}`);
    await expect(page.getByText('Storniert')).toBeVisible();
  });

  test('unbekanntes oder ungültiges Token', async ({ page }) => {
    await mockSupabase(page, { ticket: null });
    await page.goto(`/ticket/${TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Ticket nicht gefunden' })).toBeVisible();
    await page.goto('/ticket/kaputt');
    await expect(page.getByRole('heading', { name: 'Ticket nicht gefunden' })).toBeVisible();
  });
});

test('Newsletter bestätigt', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/newsletter/bestaetigt');
  await expect(
    page.getByRole('heading', { name: 'Danke! Du bist jetzt im STUDIO/F-Newsletter.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zu studio-f.club' })).toHaveAttribute(
    'href',
    'https://www.studio-f.club',
  );
});
