import type {
  Band,
  Checkin,
  ClinkEvent,
  Encounter,
  Guest,
  Lead,
  Match,
  Settings,
  Swipe,
} from "../types";

// Speicher-Schnittstelle. Zwei Umsetzungen: Supabase (Produktion) und
// Arbeitsspeicher mit Beispieldaten (Demo, wenn keine Supabase-Daten gesetzt sind).
export interface Store {
  readonly mode: "supabase" | "demo";

  listEvents(): Promise<ClinkEvent[]>;
  getEvent(id: string): Promise<ClinkEvent | null>;
  insertEvent(e: Omit<ClinkEvent, "id" | "created_at">): Promise<ClinkEvent>;
  updateEvent(id: string, patch: Partial<Omit<ClinkEvent, "id">>): Promise<void>;
  /** Setzt genau ein Event aktiv (oder keins bei null). */
  setActiveEvent(id: string | null): Promise<void>;

  listBands(): Promise<Band[]>;
  getBand(id: string): Promise<Band | null>;
  upsertBands(bands: Array<Pick<Band, "id"> & Partial<Band>>): Promise<void>;

  getGuest(id: string): Promise<Guest | null>;
  getGuests(ids: string[]): Promise<Guest[]>;
  insertGuest(g: Omit<Guest, "id" | "erstellt">): Promise<Guest>;
  updateGuest(id: string, patch: Partial<Omit<Guest, "id">>): Promise<void>;
  /** Löscht Gast samt Check-ins, Swipes und Matches. */
  deleteGuest(id: string): Promise<void>;
  uploadPhoto(guestId: string, data: Uint8Array, contentType: string): Promise<string>;

  listCheckins(filter: { event_id?: string; guest_id?: string; band_id?: string }): Promise<Checkin[]>;
  insertCheckin(c: Omit<Checkin, "created_at">): Promise<void>;
  deleteCheckin(event_id: string, band_id: string): Promise<void>;

  listEncounters(event_id: string): Promise<Encounter[]>;
  /** Fügt ein, überspringt Paare, die es für das Event schon gibt. */
  insertEncounters(rows: Encounter[]): Promise<number>;
  deleteEncounters(event_id: string): Promise<void>;

  listSwipes(filter: { event_id: string; from_guest?: string; to_guest?: string }): Promise<Swipe[]>;
  insertSwipe(s: Omit<Swipe, "created_at">): Promise<void>;
  deleteSwipes(event_id: string): Promise<void>;

  listMatches(filter: { event_id?: string; guest_id?: string }): Promise<Match[]>;
  insertMatch(m: Omit<Match, "erstellt">): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Omit<Settings, "updated_at">>): Promise<void>;

  insertLead(l: Omit<Lead, "id" | "erstellt">): Promise<void>;
  listLeads(): Promise<Lead[]>;
}
