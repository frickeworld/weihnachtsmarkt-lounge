export interface ScanBooking {
  id: string;
  booking_code: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  persons: number;
  date: string;
  start_time: string; // HH:MM
  end_time: string;
  status: 'paid' | 'cancelled' | 'pending' | 'expired';
  checked_in_at: string | null;
  taler_handed_out_at: string | null;
  token_hash?: string;
}

export interface TodayList {
  date: string;
  checkin_early_minutes: number;
  bookings: ScanBooking[];
}

export type ScanResultKind = 'ok' | 'already' | 'wrong_slot' | 'override' | 'invalid';

export interface ScanResult {
  result: ScanResultKind;
  reason?: 'unknown' | 'cancelled' | 'unpaid' | 'nolist';
  booking?: ScanBooking;
  /** Ohne Netz geprüft – wird nachgetragen */
  offline?: boolean;
}

export type QueueItem =
  | { type: 'scan'; code: string; override: boolean; scannedAt: string }
  | { type: 'taler'; bookingId: string; scannedAt: string };
