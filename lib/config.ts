// Zentrale Stellschrauben. Werte mit [Vorschlag] aus der Spezifikation.

/** [Vorschlag] Swipen ist so viele Stunden nach dem Event möglich, danach verfällt es. */
export const SWIPE_WINDOW_HOURS = 72;

/** Uhrzeit (lokal), ab der ein Abend als vorbei gilt; ab hier läuft die Swipe-Frist. */
export const EVENT_END_HOUR = 6;

/** [Vorschlag] Check-in ab 18. */
export const MIN_AGE = 18;

/** Firmware-Standardwerte, solange im Admin nichts anderes gesetzt ist. */
export const DEFAULT_SETTINGS = {
  schwelle_stoss: 2.5, // g
  schwelle_rssi: -45, // dBm, entspricht wenigen Zentimetern
  zeitfenster_ms: 100, // ca. 0,1 s
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Swipe-Frist für ein Event am Datum `datum` (YYYY-MM-DD): Ende des Abends + 72 h. */
export function swipeUntilFor(datum: string): string {
  const end = new Date(`${datum}T00:00:00`);
  end.setDate(end.getDate() + 1);
  end.setHours(EVENT_END_HOUR, 0, 0, 0);
  return new Date(end.getTime() + SWIPE_WINDOW_HOURS * 3600_000).toISOString();
}
