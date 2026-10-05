import type { IsoDate } from './dates';

/** Andere Abschnitte (z. B. „Besondere Abende“) wählen einen Termin im Buchungsbereich aus. */
export const SELECT_SLOT_EVENT = 'lounge:select-slot';

export interface SelectSlotDetail {
  date: IsoDate;
  startTime?: string;
  /** Ausgebucht: statt Zeitfenster die Warteliste für diesen Tag öffnen */
  waitlist?: boolean;
}

export function requestSlot(detail: SelectSlotDetail) {
  window.dispatchEvent(new CustomEvent<SelectSlotDetail>(SELECT_SLOT_EVENT, { detail }));
}
