import { isoWeekday } from '@/lib/dates';
import type { ExtraSlot, SlotTemplate } from './types';

export interface DaySlot {
  start_time: string;
  end_time: string;
  label: string | null;
  price_cents: number | null;
  taler_count: number | null;
  haendler_share_cents: number | null;
  /** einmaliges Zeitfenster (aus extra_slots) */
  extra: boolean;
}

/**
 * Zeitfenster eines Tages – gleiche Regel wie slot_grid() in der Datenbank:
 * Vorlagen des Wochentags, außer ein einmaliges Zeitfenster ersetzt sie (ganzer Tag) oder
 * hat dieselbe Startzeit; dazu alle einmaligen Zeitfenster des Tages.
 */
export function daySlots(date: string, templates: SlotTemplate[], extras: ExtraSlot[]): DaySlot[] {
  const own = extras.filter((e) => e.date === date);
  const replaced = own.some((e) => e.replaces_regular);
  const regular: DaySlot[] = replaced
    ? []
    : templates
        .filter((t) => t.active && t.weekday === isoWeekday(date))
        .filter((t) => !own.some((e) => e.start_time === t.start_time))
        .map((t) => ({
          start_time: t.start_time,
          end_time: t.end_time,
          label: t.label,
          price_cents: t.price_cents,
          taler_count: t.taler_count,
          haendler_share_cents: t.haendler_share_cents,
          extra: false,
        }));
  const extra: DaySlot[] = own.map((e) => ({
    start_time: e.start_time,
    end_time: e.end_time,
    label: e.label,
    price_cents: null,
    taler_count: null,
    haendler_share_cents: null,
    extra: true,
  }));
  return [...regular, ...extra].sort((a, b) => a.start_time.localeCompare(b.start_time));
}
