const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** Formatiert einen Cent-Betrag als „178,50 €“. Beträge werden im ganzen Projekt in Cent geführt. */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents))
    throw new Error(`Betrag muss in ganzen Cent angegeben sein: ${cents}`);
  return euro.format(cents / 100);
}
