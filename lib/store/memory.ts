import type { Store } from "./types";
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
import { DEFAULT_SETTINGS, SWIPE_WINDOW_HOURS } from "../config";

// Demo-Speicher: lebt im Arbeitsspeicher des Servers und startet mit
// Beispieldaten, damit sich die Seite ohne Datenbank durchklicken lässt.

type Db = {
  events: ClinkEvent[];
  bands: Band[];
  guests: Guest[];
  checkins: Checkin[];
  encounters: Encounter[];
  swipes: Swipe[];
  matches: Match[];
  settings: Settings;
  leads: Lead[];
};

export const DEMO_GUEST_ID = "demo-du";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function seed(): Db {
  const t = Date.now();
  const hours = (h: number) => new Date(t + h * 3600_000).toISOString();
  const yesterday = new Date(t - 24 * 3600_000).toISOString().slice(0, 10);
  const today = new Date(t).toISOString().slice(0, 10);

  const pastEvent: ClinkEvent = {
    id: "demo-event-gestern",
    name: "Demo · Salsa Social",
    datum: yesterday,
    location: "Demo-Tanzbar, München",
    is_active: false,
    swipe_until: hours(SWIPE_WINDOW_HOURS - 14),
    created_at: hours(-48),
  };
  const activeEvent: ClinkEvent = {
    id: "demo-event-heute",
    name: "Demo · Bachata Night",
    datum: today,
    location: "Demo-Tanzbar, München",
    is_active: true,
    swipe_until: hours(SWIPE_WINDOW_HOURS + 12),
    created_at: hours(-2),
  };

  const people: Array<[string, string, number, string | null]> = [
    [DEMO_GUEST_ID, "Du", 27, "dein.handle"],
    ["demo-lena", "Lena", 26, "lena.tanzt"],
    ["demo-mo", "Mo", 29, "mo_on_the_floor"],
    ["demo-sofia", "Sofia", 31, null],
    ["demo-jonas", "Jonas", 24, "jonas.dreht"],
    ["demo-aylin", "Aylin", 28, "aylin.salsa"],
    ["demo-noah", "Noah", 33, "noahmoves"],
  ];
  const guests: Guest[] = people.map(([id, vorname, alter, instagram]) => ({
    id,
    vorname,
    alter,
    instagram,
    instagram_freigabe: instagram !== null,
    foto: null,
    email: null,
    einwilligung_at: hours(-20),
    erstellt: hours(-20),
  }));

  const bands: Band[] = [
    { id: "778775", mac: "BC57292696C9", akku: 82, last_seen: hours(-10) },
    ...people.slice(1).map((_, i) => ({
      id: `DEMO-${String(i + 1).padStart(2, "0")}`,
      mac: null,
      akku: 40 + i * 9,
      last_seen: hours(-10),
    })),
    { id: "DEMO-07", mac: null, akku: 100, last_seen: hours(-1) },
    { id: "DEMO-08", mac: null, akku: 96, last_seen: hours(-1) },
  ];

  const bandOf = (gid: string) => (gid === DEMO_GUEST_ID ? "778775" : `DEMO-${String(people.findIndex((p) => p[0] === gid)).padStart(2, "0")}`);
  const checkins: Checkin[] = people.map(([gid]) => ({
    event_id: pastEvent.id,
    band_id: bandOf(gid),
    guest_id: gid,
    created_at: hours(-26),
  }));

  // "Du" hat mit allen anderen geclinkt, ein paar weitere Begegnungen untereinander.
  const pair = (a: string, b: string, h: number): Encounter => {
    const [x, y] = [bandOf(a), bandOf(b)].sort();
    return { event_id: pastEvent.id, band_a: x, band_b: y, timestamp: hours(-24 + h) };
  };
  const encounters: Encounter[] = [
    ...people.slice(1).map(([gid], i) => pair(DEMO_GUEST_ID, gid, i * 0.4)),
    pair("demo-lena", "demo-mo", 1.1),
    pair("demo-sofia", "demo-noah", 1.7),
  ];

  // Lena, Mo und Aylin haben "Du" schon nach rechts geswipet: rechts swipen ergibt ein Match.
  const swipes: Swipe[] = ["demo-lena", "demo-mo", "demo-aylin"].map((from) => ({
    event_id: pastEvent.id,
    from_guest: from,
    to_guest: DEMO_GUEST_ID,
    richtung: "rechts",
    created_at: hours(-8),
  }));

  return {
    events: [activeEvent, pastEvent],
    bands,
    guests,
    checkins,
    encounters,
    swipes,
    matches: [],
    settings: { ...DEFAULT_SETTINGS, updated_at: hours(-48) },
    leads: [],
  };
}

const g = globalThis as unknown as { __clinkDemoDb?: Db };
function db(): Db {
  if (!g.__clinkDemoDb) g.__clinkDemoDb = seed();
  return g.__clinkDemoDb;
}

/** Setzt nur die Swipes und Matches des Beispiel-Gastes zurück, damit die Demo frisch startet. */
export function resetDemoGuest() {
  const d = db();
  d.swipes = d.swipes.filter((s) => s.from_guest !== DEMO_GUEST_ID);
  d.matches = d.matches.filter((m) => m.guest_a !== DEMO_GUEST_ID && m.guest_b !== DEMO_GUEST_ID);
}

export const memoryStore: Store = {
  mode: "demo",

  async listEvents() {
    return [...db().events].sort((a, b) => b.datum.localeCompare(a.datum));
  },
  async getEvent(id) {
    return db().events.find((e) => e.id === id) ?? null;
  },
  async insertEvent(e) {
    const ev: ClinkEvent = { ...e, id: uid(), created_at: now() };
    db().events.push(ev);
    return ev;
  },
  async updateEvent(id, patch) {
    const ev = db().events.find((e) => e.id === id);
    if (ev) Object.assign(ev, patch);
  },
  async setActiveEvent(id) {
    for (const e of db().events) e.is_active = e.id === id;
  },

  async listBands() {
    return [...db().bands].sort((a, b) => a.id.localeCompare(b.id));
  },
  async getBand(id) {
    return db().bands.find((b) => b.id === id) ?? null;
  },
  async upsertBands(rows) {
    for (const row of rows) {
      const existing = db().bands.find((b) => b.id === row.id);
      if (existing) Object.assign(existing, row);
      else db().bands.push({ mac: null, akku: null, last_seen: null, ...row });
    }
  },

  async getGuest(id) {
    return db().guests.find((x) => x.id === id) ?? null;
  },
  async getGuests(ids) {
    return db().guests.filter((x) => ids.includes(x.id));
  },
  async insertGuest(data) {
    const guest: Guest = { ...data, id: uid(), erstellt: now() };
    db().guests.push(guest);
    return guest;
  },
  async updateGuest(id, patch) {
    const guest = db().guests.find((x) => x.id === id);
    if (guest) Object.assign(guest, patch);
  },
  async deleteGuest(id) {
    const d = db();
    d.guests = d.guests.filter((x) => x.id !== id);
    d.checkins = d.checkins.filter((c) => c.guest_id !== id);
    d.swipes = d.swipes.filter((s) => s.from_guest !== id && s.to_guest !== id);
    d.matches = d.matches.filter((m) => m.guest_a !== id && m.guest_b !== id);
  },
  async uploadPhoto(_guestId, data, contentType) {
    // Im Demo-Modus bleibt das (verkleinerte) Foto als Data-URL im Speicher.
    return `data:${contentType};base64,${Buffer.from(data).toString("base64")}`;
  },

  async listCheckins(f) {
    return db().checkins.filter(
      (c) =>
        (!f.event_id || c.event_id === f.event_id) &&
        (!f.guest_id || c.guest_id === f.guest_id) &&
        (!f.band_id || c.band_id === f.band_id),
    );
  },
  async insertCheckin(c) {
    db().checkins.push({ ...c, created_at: now() });
  },
  async deleteCheckin(event_id, band_id) {
    const d = db();
    d.checkins = d.checkins.filter((c) => !(c.event_id === event_id && c.band_id === band_id));
  },

  async listEncounters(event_id) {
    return db().encounters.filter((e) => e.event_id === event_id);
  },
  async insertEncounters(rows) {
    let inserted = 0;
    for (const row of rows) {
      const exists = db().encounters.some(
        (e) => e.event_id === row.event_id && e.band_a === row.band_a && e.band_b === row.band_b,
      );
      if (!exists) {
        db().encounters.push(row);
        inserted++;
      }
    }
    return inserted;
  },
  async deleteEncounters(event_id) {
    const d = db();
    d.encounters = d.encounters.filter((e) => e.event_id !== event_id);
  },

  async listSwipes(f) {
    return db().swipes.filter(
      (s) =>
        s.event_id === f.event_id &&
        (!f.from_guest || s.from_guest === f.from_guest) &&
        (!f.to_guest || s.to_guest === f.to_guest),
    );
  },
  async insertSwipe(s) {
    const d = db();
    d.swipes = d.swipes.filter(
      (x) => !(x.event_id === s.event_id && x.from_guest === s.from_guest && x.to_guest === s.to_guest),
    );
    d.swipes.push({ ...s, created_at: now() });
  },
  async deleteSwipes(event_id) {
    const d = db();
    d.swipes = d.swipes.filter((s) => s.event_id !== event_id);
  },

  async listMatches(f) {
    return db().matches.filter(
      (m) =>
        (!f.event_id || m.event_id === f.event_id) &&
        (!f.guest_id || m.guest_a === f.guest_id || m.guest_b === f.guest_id),
    );
  },
  async insertMatch(m) {
    const exists = db().matches.some(
      (x) => x.event_id === m.event_id && x.guest_a === m.guest_a && x.guest_b === m.guest_b,
    );
    if (!exists) db().matches.push({ ...m, erstellt: now() });
  },

  async getSettings() {
    return { ...db().settings };
  },
  async updateSettings(patch) {
    Object.assign(db().settings, patch, { updated_at: now() });
  },

  async insertLead(l) {
    db().leads.push({ ...l, id: uid(), erstellt: now() });
  },
  async listLeads() {
    return [...db().leads].reverse();
  },
};
