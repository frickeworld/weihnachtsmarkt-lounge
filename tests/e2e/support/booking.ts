import { expect, type Page } from '@playwright/test';

/** Extra-Taler-Seite zwischen Formular und Stripe (Entscheidung Louis, 17.11.2026). */
export const extraTalerStep = (page: Page) =>
  page
    .getByRole('region', { name: /Taler/ })
    .filter({ hasText: 'Letzter Schritt vor der Zahlung' });

/** Formular abschicken („Weiter“) und auf der Extra-Taler-Seite verbindlich buchen. */
export async function submitBooking(page: Page, extraTaler = 0) {
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  const step = extraTalerStep(page);
  await expect(step).toBeVisible();
  if (extraTaler > 0)
    await step
      .locator('label')
      .filter({
        has: page.getByRole('radio', { name: `${extraTaler} Extra-Taler für ${extraTaler} Euro` }),
      })
      .click();
  await step.getByRole('button', { name: 'Zahlungspflichtig buchen', exact: true }).click();
}
