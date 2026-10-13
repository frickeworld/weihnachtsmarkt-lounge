import { describe, expect, it } from 'vitest';
import { daySlots } from './daySlots';
import type { ExtraSlot, SlotTemplate } from './types';

const tpl = (weekday: number, start: string, end: string, active = true): SlotTemplate => ({
  id: weekday * 100 + Number(start.slice(0, 2)),
  weekday,
  start_time: start,
  end_time: end,
  active,
  price_cents: 14900,
  taler_count: 75,
  haendler_share_cents: null,
  label: 'Abend',
});
const templates = [
  tpl(4, '14:30:00', '16:30:00', false),
  tpl(4, '16:45:00', '18:45:00'),
  tpl(4, '19:00:00', '21:00:00'),
  tpl(6, '15:30:00', '17:30:00'),
  tpl(6, '17:45:00', '19:45:00'),
  tpl(6, '20:00:00', '22:00:00'),
];
const extra = (date: string, start: string, end: string, replaces = true): ExtraSlot => ({
  date,
  start_time: start,
  end_time: end,
  label: null,
  replaces_regular: replaces,
});

describe('daySlots', () => {
  it('nimmt die aktiven Vorlagen des Wochentags', () => {
    // Do 17.12.2026
    expect(daySlots('2026-12-17', templates, []).map((s) => s.start_time)).toEqual([
      '16:45:00',
      '19:00:00',
    ]);
  });

  it('Heiligabend: einmaliges Zeitfenster ersetzt die Vorlagen', () => {
    const r = daySlots('2026-12-24', templates, [extra('2026-12-24', '10:00:00', '13:00:00')]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ start_time: '10:00:00', end_time: '13:00:00', extra: true });
  });

  it('26.12.: zwei einmalige Zeitfenster statt drei Samstags-Vorlagen', () => {
    const r = daySlots('2026-12-26', templates, [
      extra('2026-12-26', '16:00:00', '18:00:00'),
      extra('2026-12-26', '13:00:00', '15:00:00'),
    ]);
    expect(r.map((s) => s.start_time)).toEqual(['13:00:00', '16:00:00']);
  });

  it('ohne Ersetzen: kommt dazu, gleiche Startzeit überschreibt', () => {
    const r = daySlots('2026-12-17', templates, [
      extra('2026-12-17', '12:00:00', '14:00:00', false),
      extra('2026-12-17', '19:00:00', '22:00:00', false),
    ]);
    expect(r.map((s) => `${s.start_time}-${s.end_time}-${s.extra}`)).toEqual([
      '12:00:00-14:00:00-true',
      '16:45:00-18:45:00-false',
      '19:00:00-22:00:00-true',
    ]);
  });
});
