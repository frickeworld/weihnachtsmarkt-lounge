/**
 * Händler-Anteil wie in der Datenbank (slot_pricing): Freiverzehr + Hälfte des Rests
 * (Endpreis − Vorverkaufsgebühr − Freiverzehr), abgerundet auf ganze Cent.
 * Nur zur Anzeige im Admin – verbindlich rechnet die Datenbank.
 */
export function autoHaendlerShare(
  totalCents: number,
  feeCents: number,
  talerCount: number,
): number {
  const taler = talerCount * 100;
  return taler + Math.floor(Math.max(totalCents - feeCents - taler, 0) / 2);
}
