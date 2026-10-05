/** Stufe 0–4 der Auslastungs-Heatmap (0 = nichts gebucht oder nichts angeboten). */
export function heatStep(booked: number, offered: number): number {
  if (!offered || !booked) return 0;
  const r = booked / offered;
  return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4;
}
