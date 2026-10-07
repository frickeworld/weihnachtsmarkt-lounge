import { expect, type Page } from '@playwright/test';

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** Blättert im Buchungskalender zum Monat von `date` und klickt den Tag an. */
export async function pickDay(page: Page, date: string) {
  const heading = page.locator('#buchen h3[aria-live]');
  const target = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('#buchen table button:not([disabled])').first()).toBeVisible();
    const [name, year] = (await heading.innerText()).trim().split(' ');
    const shown = Number(year) * 12 + MONTHS.indexOf(name!);
    if (shown === target) break;
    await page
      .getByRole('button', { name: shown < target ? 'Nächster Monat' : 'Vorheriger Monat' })
      .click();
    await expect(heading).not.toHaveText(`${name} ${year}`);
  }
  const label = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
}
