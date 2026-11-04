import { feeFor } from '@/lib/settings';

/** Gebührenregel aus den Einstellungen: Prozentsatz (bevorzugt) oder fester Betrag. */
export interface FeeRule {
  feeCents: number;
  feePercent: number | null;
  /** Anteil von STUDIO/F am Lounge-Preis in Prozent (Standard 28); Händler bekommen den Rest. */
  studioPercent?: number;
}

export const feeRuleOf = (s: {
  fee_cents: number;
  fee_percent?: number | string | null;
  studio_share_percent?: number | string | null;
}): FeeRule => ({
  feeCents: s.fee_cents,
  feePercent: s.fee_percent == null ? null : Number(s.fee_percent),
  studioPercent: s.studio_share_percent == null ? 28 : Number(s.studio_share_percent),
});

/**
 * Händler-Anteil wie in der Datenbank (slot_pricing, seit 04.11.2026): 72 % vom Lounge-Preis
 * (Endpreis − Verarbeitungsgebühr), mindestens der volle Freiverzehr; STUDIO/F bekommt 28 % plus
 * die Gebühr. Nur zur Anzeige im Admin – verbindlich rechnet die Datenbank.
 */
export function autoHaendlerShare(totalCents: number, fee: FeeRule, talerCount: number): number {
  const lounge = totalCents - feeFor(totalCents, fee);
  const haendlerPercent = 100 - (fee.studioPercent ?? 28);
  return Math.max(talerCount * 100, Math.round((lounge * haendlerPercent) / 100));
}
