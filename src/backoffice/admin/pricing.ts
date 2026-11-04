import { feeFor } from '@/lib/settings';

/** Gebührenregel aus den Einstellungen: Prozentsatz (bevorzugt) oder fester Betrag. */
export interface FeeRule {
  feeCents: number;
  feePercent: number | null;
}

export const feeRuleOf = (s: {
  fee_cents: number;
  fee_percent?: number | string | null;
}): FeeRule => ({
  feeCents: s.fee_cents,
  feePercent: s.fee_percent == null ? null : Number(s.fee_percent),
});

/**
 * Händler-Anteil wie in der Datenbank (slot_pricing): Freiverzehr + Hälfte des Rests
 * (Endpreis − Vorverkaufsgebühr − Freiverzehr), abgerundet auf ganze Cent.
 * Nur zur Anzeige im Admin – verbindlich rechnet die Datenbank.
 */
export function autoHaendlerShare(totalCents: number, fee: FeeRule, talerCount: number): number {
  const taler = talerCount * 100;
  return taler + Math.floor(Math.max(totalCents - feeFor(totalCents, fee) - taler, 0) / 2);
}
