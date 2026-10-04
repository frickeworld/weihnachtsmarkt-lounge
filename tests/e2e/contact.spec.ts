import { expect, test } from '@playwright/test';
import { mockSupabase } from './support/mockSupabase';

test('Kontaktformular: Prüfung, Versand an STUDIO/F, Bestätigung', async ({ page }) => {
  const contactRequests: unknown[] = [];
  await mockSupabase(page, { contactRequests });
  await page.goto('/#kontakt');
  const form = page.getByRole('form', { name: 'Kontaktformular' });
  await expect(
    page.getByRole('heading', { name: 'STUDIO/F ist dein Ansprechpartner' }),
  ).toBeVisible();

  await form.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(form.getByText('Bitte gib deinen Namen an.')).toBeVisible();
  await expect(form.getByText('Bitte wähle ein Thema.')).toBeVisible();
  expect(contactRequests).toHaveLength(0);

  await form.getByLabel('Name').fill('Anna Muster');
  await form.getByLabel('E-Mail').fill('anna@example.de');
  await form.getByLabel('Worum geht es?').selectOption('ticket');
  await form.getByLabel('Buchungscode (falls vorhanden)').fill('hlabcdefgh');
  await form.getByLabel('Deine Nachricht').fill('Ich habe kein Ticket bekommen.');
  await form.getByRole('button', { name: 'Nachricht senden' }).click();
  await expect(
    page.getByRole('heading', { name: 'Danke! Wir melden uns so schnell wie möglich.' }),
  ).toBeVisible();
  expect(contactRequests[0]).toMatchObject({
    name: 'Anna Muster',
    email: 'anna@example.de',
    topic: 'ticket',
    bookingCode: 'HL-ABCD-EFGH',
    website: '',
  });
});

test('Footer: großes „Powered by STUDIO/F“ und Kontakt-Link; FAQ verweist aufs Formular', async ({
  page,
}) => {
  await mockSupabase(page);
  await page.goto('/');
  const badge = page.getByRole('contentinfo').getByRole('img', { name: 'STUDIO/F' });
  await badge.scrollIntoViewIfNeeded();
  expect((await badge.boundingBox())!.height).toBeGreaterThanOrEqual(50);
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: 'Kontakt' }),
  ).toHaveAttribute('href', '/#kontakt');
  await page.getByText('Ich habe kein Ticket bekommen. Was nun?').click();
  await expect(page.getByRole('link', { name: 'Kontaktformular' })).toBeVisible();
});
