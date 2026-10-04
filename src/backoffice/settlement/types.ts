export interface SettlementRow {
  date: string;
  start_time: string;
  end_time: string;
  booking_code: string;
  name: string;
  company_name: string | null;
  persons: number;
  source: 'online' | 'manual';
  checked_in: boolean;
  haendler_share_cents: number;
  /** nur für Admins */
  amount_total_cents: number | null;
}

export interface Settlement {
  from: string;
  to: string;
  count: number;
  haendler_cents: number;
  revenue_cents: number | null;
  studio_cents: number | null;
  no_shows: number;
  excluded_cancelled: number;
  excluded_not_in_settlement: number;
  rows: SettlementRow[];
}
