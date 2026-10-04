export interface HaendlerBooking {
  id: string;
  booking_code: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  persons: number;
  occasion: string | null;
  status: 'paid' | 'cancelled';
  checked_in_at: string | null;
  taler_handed_out_at: string | null;
  no_show: boolean;
  include_in_settlement: boolean;
  haendler_share_cents: number;
}

export interface HaendlerDashboard {
  page_views: number;
  book_clicks: number;
  paid_bookings: number;
  online_paid_in_period: number;
  available_slots: number;
  haendler_cents: number;
  checked_in: number;
  no_shows: number;
  taler_handed_out: number;
  cancelled: number;
  daily: { date: string; page_views: number; book_clicks: number; bookings: number }[];
}
