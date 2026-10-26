import "server-only";
import { getStore } from "./store";
import type { ClinkEvent, Encounter, Guest, Match, MatchKey, SwipeDirection } from "./types";
import { CHAT_WINDOW_HOURS, MESSAGE_MAX } from "./config";
import { getCard } from "./cards";

// Ablauf-Logik über dem Speicher: Check-in, Import, Swipen, Matches, Löschfristen.

export const pairKey = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export const isOpen = (e: ClinkEvent, at = Date.now()) => new Date(e.swipe_until).getTime() > at;

/** Löschung nach Ablauf der Fristen: Begegnungen und Swipes, abgelaufene Chats. Matches bleiben. */
export async function purgeExpired(): Promise<number> {
  const store = getStore();
  let purged = 0;
  for (const m of await store.listMatches({})) {
    if (new Date(m.chat_until).getTime() <= Date.now() && (await store.listMessages(m)).length) {
      await store.deleteMessages(m);
      purged++;
    }
  }
  for (const e of await store.listEvents()) {
    if (isOpen(e)) continue;
    const enc = await store.listEncounters(e.id);
    const sw = await store.listSwipes({ event_id: e.id });
    if (enc.length || sw.length) {
      await store.deleteEncounters(e.id);
      await store.deleteSwipes(e.id);
      purged++;
    }
  }
  return purged;
}

// ---------- Check-in ----------

export type CheckinInput = {
  bandId: string;
  vorname: string;
  alter: number;
  instagram: string | null;
  instagramFreigabe: boolean;
  email: string | null;
  foto: { data: Uint8Array; type: string } | null;
};

export type CheckinResult = { ok: true; guestId: string; event: ClinkEvent } | { ok: false; error: string };

export function normalizeBandId(raw: string): string {
  return raw.trim().toUpperCase().replace(/^ID[:\s]*/, "").replace(/\s+/g, "");
}

export function normalizeInstagram(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

/** Ordnet ein Band für das aktive Event einem (neuen oder bekannten) Gast zu. */
export async function checkin(input: CheckinInput, existingGuestId: string | null): Promise<CheckinResult> {
  const store = getStore();
  const event = (await store.listEvents()).find((e) => e.is_active);
  if (!event) return { ok: false, error: "Gerade läuft kein CLINK-Abend. Frag am Eingang nach." };

  const bandId = normalizeBandId(input.bandId);
  const band = await store.getBand(bandId);
  if (!band) return { ok: false, error: `Band „${bandId}“ kennen wir nicht. Prüf die Nummer auf dem Band.` };

  const taken = await store.listCheckins({ event_id: event.id, band_id: bandId });
  if (taken.length && taken[0].guest_id !== existingGuestId) {
    return { ok: false, error: "Dieses Band ist heute schon vergeben. Bitte wende dich ans Personal." };
  }

  let guest: Guest | null = existingGuestId ? await store.getGuest(existingGuestId) : null;
  const profile = {
    vorname: input.vorname,
    alter: input.alter,
    instagram: input.instagram,
    instagram_freigabe: input.instagramFreigabe && input.instagram !== null,
    email: input.email,
    einwilligung_at: new Date().toISOString(),
  };
  if (guest) {
    await store.updateGuest(guest.id, profile);
  } else {
    guest = await store.insertGuest({ ...profile, foto: null });
  }
  if (input.foto) {
    const url = await store.uploadPhoto(guest.id, input.foto.data, input.foto.type);
    await store.updateGuest(guest.id, { foto: url });
  }

  // Ein Gast trägt pro Abend genau ein Band: altes Band dieses Abends freigeben.
  for (const c of await store.listCheckins({ event_id: event.id, guest_id: guest.id })) {
    if (c.band_id !== bandId) await store.deleteCheckin(event.id, c.band_id);
  }
  if (!taken.length) await store.insertCheckin({ event_id: event.id, band_id: bandId, guest_id: guest.id });
  return { ok: true, guestId: guest.id, event };
}

// ---------- Import der Begegnungen ----------

export type ParsedCsv = { rows: Array<{ a: string; b: string; ts: string }>; errors: string[] };

/** CSV im Format `band_a,band_b,timestamp` (Kopfzeile optional). */
export function parseEncounterCsv(text: string): ParsedCsv {
  const rows: ParsedCsv["rows"] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const l = line.trim();
    if (!l || l.startsWith("#")) return;
    const cells = l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /band_a/i.test(cells[0] ?? "")) return;
    if (cells.length < 3) return void errors.push(`Zeile ${i + 1}: drei Spalten erwartet`);
    const [a, b, ts] = cells;
    if (!a || !b) return void errors.push(`Zeile ${i + 1}: Band-ID fehlt`);
    if (normalizeBandId(a) === normalizeBandId(b)) return void errors.push(`Zeile ${i + 1}: Band mit sich selbst`);
    if (Number.isNaN(Date.parse(ts))) return void errors.push(`Zeile ${i + 1}: Zeitstempel „${ts}“ ungültig`);
    rows.push({ a: normalizeBandId(a), b: normalizeBandId(b), ts: new Date(ts).toISOString() });
  });
  return { rows, errors };
}

export type ImportResult = {
  gelesen: number;
  neu: number;
  doppelt: number;
  ohneCheckin: number;
  fehler: string[];
};

/** Speichert Begegnungen; jedes Paar zählt pro Abend nur einmal (beide Bänder melden es). */
export async function importEncounters(eventId: string, parsed: ParsedCsv): Promise<ImportResult> {
  const store = getStore();
  const checkedIn = new Set((await store.listCheckins({ event_id: eventId })).map((c) => c.band_id));
  const unique = new Map<string, Encounter>();
  let ohneCheckin = 0;
  for (const r of parsed.rows) {
    const [band_a, band_b] = pairKey(r.a, r.b);
    if (!checkedIn.has(band_a) || !checkedIn.has(band_b)) ohneCheckin++;
    const key = `${band_a}|${band_b}`;
    const prev = unique.get(key);
    if (!prev || prev.timestamp > r.ts) unique.set(key, { event_id: eventId, band_a, band_b, timestamp: r.ts });
  }
  const neu = await store.insertEncounters([...unique.values()]);
  return {
    gelesen: parsed.rows.length,
    neu,
    doppelt: parsed.rows.length - neu,
    ohneCheckin,
    fehler: parsed.errors,
  };
}

// ---------- Gast-Sicht ----------

export type PublicProfile = { id: string; vorname: string; alter: number; foto: string | null };

const toPublic = (g: Guest): PublicProfile => ({ id: g.id, vorname: g.vorname, alter: g.alter, foto: g.foto });

export type GuestEventView = {
  event: ClinkEvent;
  open: boolean;
  importiert: boolean; // Begegnungen sind schon ausgelesen
  begegnungen: number;
  offen: Array<PublicProfile & { zeit: string }>; // noch nicht geswipet
};

/** Begegnungen eines Gastes je Abend, neuestes zuerst. */
export async function guestEvents(guestId: string): Promise<GuestEventView[]> {
  const store = getStore();
  const views: GuestEventView[] = [];
  for (const c of await store.listCheckins({ guest_id: guestId })) {
    const event = await store.getEvent(c.event_id);
    if (!event) continue;
    const checkins = await store.listCheckins({ event_id: event.id });
    const guestOfBand = new Map(checkins.map((x) => [x.band_id, x.guest_id]));
    const encounters = await store.listEncounters(event.id);
    const mine = encounters.filter((e) => e.band_a === c.band_id || e.band_b === c.band_id);
    const others = new Map<string, string>();
    for (const e of mine) {
      const other = guestOfBand.get(e.band_a === c.band_id ? e.band_b : e.band_a);
      if (other && other !== guestId && !others.has(other)) others.set(other, e.timestamp);
    }
    const swiped = new Set((await store.listSwipes({ event_id: event.id, from_guest: guestId })).map((s) => s.to_guest));
    const profiles = await store.getGuests([...others.keys()].filter((id) => !swiped.has(id)));
    views.push({
      event,
      open: isOpen(event),
      importiert: encounters.length > 0,
      begegnungen: others.size,
      offen: profiles
        .map((p) => ({ ...toPublic(p), zeit: others.get(p.id)! }))
        .sort((a, b) => a.zeit.localeCompare(b.zeit)),
    });
  }
  return views.sort((a, b) => b.event.datum.localeCompare(a.event.datum));
}

export type SwipeResult =
  | { ok: true; match: null | { vorname: string; foto: string | null; instagram: string | null; chat: string } }
  | { ok: false; error: string };

/** URL des Chats mit einem Match, aus Sicht des eingeloggten Gastes. */
export const chatPath = (eventId: string, partnerId: string) => `/app/chat/${eventId}/${partnerId}`;

export async function swipe(guestId: string, eventId: string, toGuest: string, richtung: SwipeDirection): Promise<SwipeResult> {
  const store = getStore();
  const event = await store.getEvent(eventId);
  if (!event || !isOpen(event)) return { ok: false, error: "Die Swipe-Zeit für diesen Abend ist vorbei." };

  // Nur wer wirklich geclinkt hat, darf geswipet werden.
  const view = (await guestEvents(guestId)).find((v) => v.event.id === eventId);
  if (!view?.offen.some((p) => p.id === toGuest)) return { ok: false, error: "Diese Begegnung gibt es nicht (mehr)." };

  await store.insertSwipe({ event_id: eventId, from_guest: guestId, to_guest: toGuest, richtung });
  if (richtung !== "rechts") return { ok: true, match: null };

  const back = await store.listSwipes({ event_id: eventId, from_guest: toGuest, to_guest: guestId });
  if (back[0]?.richtung !== "rechts") return { ok: true, match: null };

  const [guest_a, guest_b] = pairKey(guestId, toGuest);
  await store.insertMatch({
    event_id: eventId,
    guest_a,
    guest_b,
    chat_until: new Date(Date.now() + CHAT_WINDOW_HOURS * 3600_000).toISOString(),
    verlaengern_a: false,
    verlaengern_b: false,
  });
  const partner = await store.getGuest(toGuest);
  return {
    ok: true,
    match: partner
      ? {
          vorname: partner.vorname,
          foto: partner.foto,
          instagram: partner.instagram_freigabe ? partner.instagram : null,
          chat: chatPath(eventId, toGuest),
        }
      : null,
  };
}

export type MatchView = PublicProfile & {
  instagram: string | null;
  event: string;
  erstellt: string;
  chat: string;
  chatOffen: boolean;
  chatUntil: string;
  letzte: null | { vonMir: boolean; text: string; zeit: string };
};

export async function guestMatches(guestId: string): Promise<MatchView[]> {
  const store = getStore();
  const matches = await store.listMatches({ guest_id: guestId });
  const partners = new Map((await store.getGuests(matches.map((m) => (m.guest_a === guestId ? m.guest_b : m.guest_a)))).map((g) => [g.id, g]));
  const events = new Map((await store.listEvents()).map((e) => [e.id, e]));
  const views = await Promise.all(
    matches.map(async (m): Promise<MatchView | null> => {
      const p = partners.get(m.guest_a === guestId ? m.guest_b : m.guest_a);
      if (!p) return null;
      const open = new Date(m.chat_until).getTime() > Date.now();
      const last = open ? (await store.listMessages(m)).at(-1) : undefined;
      return {
        ...toPublic(p),
        // Datensparsam: Instagram nur nach Match und nur wenn freigegeben.
        instagram: p.instagram_freigabe ? p.instagram : null,
        event: events.get(m.event_id)?.name ?? "",
        erstellt: m.erstellt,
        chat: chatPath(m.event_id, p.id),
        chatOffen: open,
        chatUntil: m.chat_until,
        letzte: last ? { vonMir: last.from_guest === guestId, text: last.text, zeit: last.created_at } : null,
      };
    }),
  );
  return views
    .filter((x): x is MatchView => x !== null)
    .sort((a, b) => (b.letzte?.zeit ?? b.erstellt).localeCompare(a.letzte?.zeit ?? a.erstellt));
}

// ---------- Chat ----------

async function findMatch(guestId: string, eventId: string, partnerId: string): Promise<Match | null> {
  const [guest_a, guest_b] = pairKey(guestId, partnerId);
  const matches = await getStore().listMatches({ event_id: eventId, guest_id: guestId });
  return matches.find((m) => m.guest_a === guest_a && m.guest_b === guest_b) ?? null;
}

export type ChatView = {
  eventId: string;
  partner: PublicProfile & { instagram: string | null };
  event: string;
  chatUntil: string;
  offen: boolean;
  ichVerlaengere: boolean;
  partnerVerlaengert: boolean;
  nachrichten: Array<{ id: string; vonMir: boolean; karte: boolean; text: string; zeit: string }>;
};

export async function getChat(guestId: string, eventId: string, partnerId: string): Promise<ChatView | null> {
  const store = getStore();
  const match = await findMatch(guestId, eventId, partnerId);
  const partner = match ? await store.getGuest(partnerId) : null;
  if (!match || !partner) return null;
  const iAmA = match.guest_a === guestId;
  const offen = new Date(match.chat_until).getTime() > Date.now();
  const messages = offen ? await store.listMessages(match) : [];
  return {
    eventId,
    partner: { ...toPublic(partner), instagram: partner.instagram_freigabe ? partner.instagram : null },
    event: (await store.getEvent(eventId))?.name ?? "",
    chatUntil: match.chat_until,
    offen,
    ichVerlaengere: iAmA ? match.verlaengern_a : match.verlaengern_b,
    partnerVerlaengert: iAmA ? match.verlaengern_b : match.verlaengern_a,
    nachrichten: messages.map((m) => ({
      id: m.id,
      vonMir: m.from_guest === guestId,
      karte: m.karte !== null,
      text: m.text,
      zeit: m.created_at,
    })),
  };
}

export type ChatResult = { ok: true } | { ok: false; error: string };

/** Erste Nachricht im Chat muss eine Antwortkarte sein, danach ist freier Text erlaubt. */
export async function sendMessage(
  guestId: string,
  eventId: string,
  partnerId: string,
  input: { karte: string } | { text: string },
): Promise<ChatResult> {
  const store = getStore();
  const match = await findMatch(guestId, eventId, partnerId);
  if (!match) return { ok: false, error: "Dieses Match gibt es nicht mehr." };
  if (new Date(match.chat_until).getTime() <= Date.now()) return { ok: false, error: "Der Chat ist abgelaufen." };

  if ("karte" in input) {
    const card = getCard(input.karte);
    if (!card) return { ok: false, error: "Diese Karte gibt es nicht." };
    await store.insertMessage({ ...keyOf(match), from_guest: guestId, karte: card.id, text: card.text });
    return { ok: true };
  }

  const text = input.text.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX);
  if (!text) return { ok: false, error: "Die Nachricht ist leer." };
  if (!(await store.listMessages(match)).length) return { ok: false, error: "Starte mit einer Antwortkarte." };
  await store.insertMessage({ ...keyOf(match), from_guest: guestId, karte: null, text });
  return { ok: true };
}

/** Beide tippen auf "Verlängern" → Chat läuft 72 h länger, die Stimmen werden zurückgesetzt. */
export async function voteExtend(guestId: string, eventId: string, partnerId: string): Promise<ChatResult & { verlaengert?: boolean }> {
  const store = getStore();
  const match = await findMatch(guestId, eventId, partnerId);
  if (!match) return { ok: false, error: "Dieses Match gibt es nicht mehr." };
  const until = new Date(match.chat_until).getTime();
  if (until <= Date.now()) return { ok: false, error: "Der Chat ist schon abgelaufen." };

  const iAmA = match.guest_a === guestId;
  const other = iAmA ? match.verlaengern_b : match.verlaengern_a;
  if (other) {
    await store.updateMatch(match, {
      chat_until: new Date(until + CHAT_WINDOW_HOURS * 3600_000).toISOString(),
      verlaengern_a: false,
      verlaengern_b: false,
    });
    return { ok: true, verlaengert: true };
  }
  await store.updateMatch(match, iAmA ? { verlaengern_a: true } : { verlaengern_b: true });
  return { ok: true, verlaengert: false };
}

/** Match auflösen: Chat und Match verschwinden für beide. */
export async function unmatch(guestId: string, eventId: string, partnerId: string): Promise<void> {
  const match = await findMatch(guestId, eventId, partnerId);
  if (match) await getStore().deleteMatch(match);
}

const keyOf = (m: MatchKey): MatchKey => ({ event_id: m.event_id, guest_a: m.guest_a, guest_b: m.guest_b });

// ---------- Statistik ----------

export type EventStats = {
  event: ClinkEvent;
  gaeste: number;
  begegnungen: number;
  swipes: number;
  swipeRate: number | null; // Anteil der Begegnungs-Seiten, die geswipet wurden
  rechtsRate: number | null;
  matches: number;
  matchRate: number | null; // Matches pro Begegnung
};

export async function eventStats(): Promise<EventStats[]> {
  const store = getStore();
  const out: EventStats[] = [];
  for (const event of await store.listEvents()) {
    const [checkins, encounters, swipes, matches] = await Promise.all([
      store.listCheckins({ event_id: event.id }),
      store.listEncounters(event.id),
      store.listSwipes({ event_id: event.id }),
      store.listMatches({ event_id: event.id }),
    ]);
    const rechts = swipes.filter((s) => s.richtung === "rechts").length;
    const seiten = encounters.length * 2;
    out.push({
      event,
      gaeste: checkins.length,
      begegnungen: encounters.length,
      swipes: swipes.length,
      swipeRate: seiten ? swipes.length / seiten : null,
      rechtsRate: swipes.length ? rechts / swipes.length : null,
      matches: matches.length,
      matchRate: encounters.length ? matches.length / encounters.length : null,
    });
  }
  return out;
}
