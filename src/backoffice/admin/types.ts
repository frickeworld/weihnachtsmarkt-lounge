export type BookingStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export interface Booking {
  id: string;
  booking_code: string;
  date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  source: 'online' | 'manual';
  payment_method: 'stripe' | 'bar' | 'ueberweisung' | 'kostenlos';
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  persons: number;
  occasion: string | null;
  company_name: string | null;
  vat_id: string | null;
  invoice_requested: boolean;
  billing_street: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  notes: string | null;
  newsletter_opt_in: boolean;
  price_cents: number;
  fee_cents: number;
  haendler_share_cents: number;
  amount_total_cents: number;
  include_in_settlement: boolean;
  stripe_payment_intent_id: string | null;
  stripe_invoice_url: string | null;
  hold_expires_at: string | null;
  paid_at: string | null;
  checked_in_at: string | null;
  taler_handed_out_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  reminder_sent_at: string | null;
  admin_override: boolean;
  anonymized_at: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Reserviert',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
  expired: 'Abgelaufen',
};

export const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-950',
  paid: 'bg-emerald-100 text-emerald-950',
  cancelled: 'bg-red-100 text-red-950',
  expired: 'bg-sand text-ink-soft',
};

export const PAYMENT_LABEL: Record<Booking['payment_method'], string> = {
  stripe: 'Online (Stripe)',
  bar: 'Bar',
  ueberweisung: 'Überweisung',
  kostenlos: 'Kostenlos',
};

export const OCCASION_LABEL: Record<string, string> = {
  firmenfeier: 'Firmenfeier',
  familienfeier: 'Familienfeier',
  freunde: 'Freunde',
  sonstiges: 'Sonstiges',
};

export interface DashboardData {
  page_views: number;
  book_clicks: number;
  paid_bookings: number;
  online_paid_in_period: number;
  available_slots: number;
  revenue_cents: number;
  haendler_cents: number;
  studio_cents: number;
  checked_in: number;
  no_shows: number;
  taler_handed_out: number;
  pending: number;
  cancelled: number;
  daily: { date: string; page_views: number; book_clicks: number; bookings: number }[];
}

export interface AdminSettings {
  season_start: string;
  season_end: string;
  price_cents: number;
  fee_cents: number;
  taler_count: number;
  taler_cents: number;
  haendler_share_cents: number;
  max_persons: number;
  booking_cutoff_minutes: number;
  hold_minutes: number;
  checkin_early_minutes: number;
  contact_email: string;
  lounge_location: string;
  updated_at: string;
}

export interface SlotTemplate {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
  /** Endpreis inkl. Vorverkaufsgebühr; null = Standardpreis aus den Einstellungen */
  price_cents: number | null;
  taler_count: number | null;
  /** null = automatisch (Freiverzehr + Hälfte des Rests) */
  haendler_share_cents: number | null;
  label: string | null;
}

export interface SlotSpecial {
  date: string;
  start_time: string;
  title: string;
  price_cents: number;
  taler_count: number;
  haendler_share_cents: number | null;
  act: string | null;
  description: string | null;
}

export interface AccessRow {
  user_id: string;
  email: string;
  roles: string[];
  last_sign_in_at: string | null;
  invited_at: string | null;
  has_2fa: boolean;
}

export interface EmailLogRow {
  id: number;
  type: string;
  status: 'sent' | 'failed';
  error: string | null;
  created_at: string;
}
