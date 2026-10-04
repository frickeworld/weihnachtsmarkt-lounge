import { describe, expect, it } from 'vitest';
import { evaluateOffline, normalizeCode, sha256Hex, talerOffline } from './offline';
import type { ScanBooking, TodayList } from './types';

const TOKEN = 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z';

async function list(over: Partial<ScanBooking> = {}): Promise<TodayList> {
  return {
    date: '2026-12-05',
    checkin_early_minutes: 30,
    bookings: [
      {
        id: 'b1',
        booking_code: 'HL-ABCD-EFGH',
        first_name: 'Anna',
        last_name: 'Muster',
        company_name: null,
        persons: 8,
        date: '2026-12-05',
        start_time: '17:30',
        end_time: '19:30',
        status: 'paid',
        checked_in_at: null,
        taler_handed_out_at: null,
        token_hash: await sha256Hex(TOKEN),
        ...over,
      },
    ],
  };
}
// 05.12.2026 ist Winterzeit (UTC+1): 17:30 Berlin = 16:30 UTC
const at = (hhmm: string) => new Date(`2026-12-05T${hhmm}:00+01:00`);

describe('normalizeCode', () => {
  it('erkennt Token und Buchungscode in allen Schreibweisen', () => {
    expect(normalizeCode(` ${TOKEN} `)).toEqual({ kind: 'token', value: TOKEN });
    expect(normalizeCode('hlabcdefgh')).toEqual({ kind: 'code', value: 'HL-ABCD-EFGH' });
    expect(normalizeCode('HL ABCD EFGH')).toEqual({ kind: 'code', value: 'HL-ABCD-EFGH' });
    expect(normalizeCode('quatsch')).toBeNull();
  });
});

describe('evaluateOffline', () => {
  it('grün im Zeitfenster (ab 30 Minuten vorher) und merkt den Check-in', async () => {
    const r = await evaluateOffline(TOKEN, await list(), at('17:00'));
    expect(r.result.result).toBe('ok');
    expect(r.result.offline).toBe(true);
    expect(r.today.bookings[0]!.checked_in_at).toBe(at('17:00').toISOString());
    const again = await evaluateOffline('HL-ABCD-EFGH', r.today, at('17:05'));
    expect(again.result.result).toBe('already');
  });

  it('orange zu früh oder zu spät, mit Bestätigung eingecheckt', async () => {
    expect((await evaluateOffline(TOKEN, await list(), at('16:59'))).result.result).toBe(
      'wrong_slot',
    );
    expect((await evaluateOffline(TOKEN, await list(), at('19:31'))).result.result).toBe(
      'wrong_slot',
    );
    expect((await evaluateOffline(TOKEN, await list(), at('19:30'))).result.result).toBe('ok');
    expect((await evaluateOffline(TOKEN, await list(), at('20:00'), true)).result.result).toBe(
      'override',
    );
  });

  it('rot bei storniert oder unbekannt', async () => {
    const r = await evaluateOffline(TOKEN, await list({ status: 'cancelled' }), at('17:30'));
    expect(r.result).toMatchObject({ result: 'invalid', reason: 'cancelled' });
    expect((await evaluateOffline('HL-ZZZZ-ZZZZ', await list(), at('17:30'))).result.reason).toBe(
      'unknown',
    );
    expect((await evaluateOffline('A'.repeat(32), await list(), at('17:30'))).result.reason).toBe(
      'unknown',
    );
  });

  it('Taler offline setzt auch den Check-in', async () => {
    const t = talerOffline('b1', await list(), at('17:40'));
    expect(t.bookings[0]!.taler_handed_out_at).toBe(at('17:40').toISOString());
    expect(t.bookings[0]!.checked_in_at).toBe(at('17:40').toISOString());
  });
});
