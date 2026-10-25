// Datenmodell nach Spezifikation 4.5 (Minimum), ergänzt um wenige Felder,
// die der Ablauf braucht (aktives Event, Swipe-Frist, Einwilligungen).

export type ClinkEvent = {
  id: string;
  name: string;
  datum: string; // ISO-Datum, z. B. "2026-11-14"
  location: string;
  is_active: boolean; // Check-in läuft für dieses Event
  swipe_until: string; // ISO-Zeitpunkt, danach verfällt das Swipen
  created_at: string;
};

export type Band = {
  id: string; // Geräte-ID vom Aufkleber, z. B. "778775"
  mac: string | null; // Bluetooth-Adresse, z. B. "BC57292696C9"
  akku: number | null; // Prozent
  last_seen: string | null;
};

export type Guest = {
  id: string;
  vorname: string;
  foto: string | null; // URL
  alter: number;
  instagram: string | null; // ohne "@"
  instagram_freigabe: boolean; // nach Match zeigen
  email: string | null; // für den Link am nächsten Tag
  einwilligung_at: string;
  erstellt: string;
};

export type Checkin = {
  event_id: string;
  band_id: string;
  guest_id: string;
  created_at: string;
};

export type Encounter = {
  event_id: string;
  band_a: string; // immer die kleinere ID (pro Paar nur einmal)
  band_b: string;
  timestamp: string;
};

export type SwipeDirection = "rechts" | "links";

export type Swipe = {
  event_id: string;
  from_guest: string;
  to_guest: string;
  richtung: SwipeDirection;
  created_at: string;
};

export type Match = {
  event_id: string;
  guest_a: string; // kleinere ID
  guest_b: string;
  erstellt: string;
};

export type Settings = {
  schwelle_stoss: number; // in g
  schwelle_rssi: number; // in dBm
  zeitfenster_ms: number;
  updated_at: string;
};

export type Lead = {
  id: string;
  name: string;
  location: string;
  stadt: string;
  email: string;
  nachricht: string;
  erstellt: string;
};
