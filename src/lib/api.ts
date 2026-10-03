import type { SlotAvailability, SlotStatus } from './availability';
import type { IsoDate } from './dates';
import type { PublicSettings } from './settings';
import { supabase } from './supabase';

export class ApiUnavailableError extends Error {
  constructor() {
    super('Supabase ist nicht konfiguriert');
  }
}

function client() {
  if (!supabase) throw new ApiUnavailableError();
  return supabase;
}

interface SettingsRow {
  price_cents: number;
  fee_cents: number;
  taler_count: number;
  max_persons: number;
  season_start: string;
  season_end: string;
  contact_email: string;
  booking_cutoff_minutes: number;
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await client().rpc('get_public_settings').single<SettingsRow>();
  if (error) throw error;
  // Unvollständige Antworten nie übernehmen – dann bleiben die Startwerte stehen.
  const ints = [
    data.price_cents,
    data.fee_cents,
    data.taler_count,
    data.max_persons,
    data.booking_cutoff_minutes,
  ];
  if (!ints.every((n) => Number.isInteger(n)) || !data.season_start || !data.season_end) {
    throw new Error('Ungültige Einstellungen');
  }
  return {
    priceCents: data.price_cents,
    feeCents: data.fee_cents,
    talerCount: data.taler_count,
    maxPersons: data.max_persons,
    seasonStart: data.season_start,
    seasonEnd: data.season_end,
    contactEmail: data.contact_email,
    bookingCutoffMinutes: data.booking_cutoff_minutes,
  };
}

interface AvailabilityRow {
  slot_date: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
}

export async function fetchAvailability(from: IsoDate, to: IsoDate): Promise<SlotAvailability[]> {
  const { data, error } = await client().rpc('get_availability', { from_date: from, to_date: to });
  if (error) throw error;
  return (data as AvailabilityRow[]).map((r) => ({
    date: r.slot_date,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    status: r.status,
  }));
}

export async function trackEvent(
  eventType: 'page_view' | 'book_click',
  device: 'mobile' | 'desktop',
) {
  if (!supabase) return;
  await supabase.rpc('track_event', { event_type: eventType, device });
}
