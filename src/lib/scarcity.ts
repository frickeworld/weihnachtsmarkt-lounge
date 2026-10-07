export interface Scarcity {
  freeTotal: number;
  offeredTotal: number;
  freeWeekendEve: number;
}

/**
 * Hinweis nur bei echter Knappheit – keine erfundene Dringlichkeit.
 * Wochenend-Abende (Fr/Sa 17:45 und 20:00) zuerst, sonst die Gesamtzahl.
 */
export function scarcityMessage(s: Scarcity | null): string | null {
  if (!s || s.offeredTotal === 0 || s.freeTotal === 0) return null;
  if (s.freeWeekendEve > 0 && s.freeWeekendEve <= 8)
    return s.freeWeekendEve === 1
      ? 'Nur noch 1 Abend am Wochenende frei'
      : `Nur noch ${s.freeWeekendEve} Abende am Wochenende frei`;
  if (s.freeTotal <= 15)
    return s.freeTotal === 1 ? 'Nur noch 1 Termin frei' : `Nur noch ${s.freeTotal} Termine frei`;
  if (s.freeWeekendEve === 0) return 'Wochenend-Abende ausgebucht – unter der Woche ist noch Platz';
  return null;
}
