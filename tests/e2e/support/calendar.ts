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

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

/**
 * Blättert im Buchungskalender zum Monat von `date` und klickt den Tag an. Ist der Tag schon
 * sichtbar (auch als Tag des Nachbarmonats, z. B. 30.11. in der Dezember-Ansicht), direkt klicken.
 */
export async function pickDay(page: Page, date: string) {
  const heading = page.locator('#buchen h3[aria-live]');
  const day = page.getByRole('button', { name: new RegExp(`^${dayLabel(date)}`) });
  const target = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('#buchen table button:not([disabled])').first()).toBeVisible();
    if (await day.isVisible()) break;
    const [name, year] = (await heading.innerText()).trim().split(' ');
    const shown = Number(year) * 12 + MONTHS.indexOf(name!);
    if (shown === target) break;
    await page
      .getByRole('button', { name: shown < target ? 'Nächster Monat' : 'Vorheriger Monat' })
      .click();
    await expect(heading).not.toHaveText(`${name} ${year}`);
  }
  await day.click();
}
