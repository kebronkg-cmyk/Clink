import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "./types";
import type { Band, Checkin, ClinkEvent, Encounter, Guest, Lead, Match, MatchKey, Message, Settings, Swipe } from "../types";
import { DEFAULT_SETTINGS } from "../config";

// Supabase-Umsetzung. Läuft nur auf dem Server mit dem Service-Role-Key;
// Row Level Security ist in der Datenbank an, ohne öffentliche Policies.

const PHOTO_BUCKET = "photos";

const keyOf = (k: MatchKey) => ({ event_id: k.event_id, guest_a: k.guest_a, guest_b: k.guest_b });

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export function createSupabaseStore(url: string, key: string): Store {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

  return {
    mode: "supabase",

    async listEvents() {
      return check(await sb.from("events").select("*").order("datum", { ascending: false })) as ClinkEvent[];
    },
    async getEvent(id) {
      return check(await sb.from("events").select("*").eq("id", id).maybeSingle()) as ClinkEvent | null;
    },
    async insertEvent(e) {
      return check(await sb.from("events").insert(e).select().single()) as ClinkEvent;
    },
    async updateEvent(id, patch) {
      check(await sb.from("events").update(patch).eq("id", id));
    },
    async setActiveEvent(id) {
      check(await sb.from("events").update({ is_active: false }).eq("is_active", true));
      if (id) check(await sb.from("events").update({ is_active: true }).eq("id", id));
    },

    async listBands() {
      return check(await sb.from("bands").select("*").order("id")) as Band[];
    },
    async getBand(id) {
      return check(await sb.from("bands").select("*").eq("id", id).maybeSingle()) as Band | null;
    },
    async upsertBands(rows) {
      if (rows.length) check(await sb.from("bands").upsert(rows, { onConflict: "id" }));
    },

    async getGuest(id) {
      return check(await sb.from("guests").select("*").eq("id", id).maybeSingle()) as Guest | null;
    },
    async getGuests(ids) {
      if (!ids.length) return [];
      return check(await sb.from("guests").select("*").in("id", ids)) as Guest[];
    },
    async insertGuest(g) {
      return check(await sb.from("guests").insert(g).select().single()) as Guest;
    },
    async updateGuest(id, patch) {
      check(await sb.from("guests").update(patch).eq("id", id));
    },
    async deleteGuest(id) {
      // Check-ins, Swipes und Matches hängen per ON DELETE CASCADE am Gast.
      check(await sb.from("guests").delete().eq("id", id));
      await sb.storage.from(PHOTO_BUCKET).remove([`${id}.jpg`]);
    },
    async uploadPhoto(guestId, data, contentType) {
      const path = `${guestId}.jpg`;
      check(await sb.storage.from(PHOTO_BUCKET).upload(path, data, { contentType, upsert: true }));
      return `${sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    },

    async listCheckins(f) {
      let q = sb.from("checkins").select("*");
      if (f.event_id) q = q.eq("event_id", f.event_id);
      if (f.guest_id) q = q.eq("guest_id", f.guest_id);
      if (f.band_id) q = q.eq("band_id", f.band_id);
      return check(await q) as Checkin[];
    },
    async insertCheckin(c) {
      check(await sb.from("checkins").insert(c));
    },
    async deleteCheckin(event_id, band_id) {
      check(await sb.from("checkins").delete().eq("event_id", event_id).eq("band_id", band_id));
    },

    async listEncounters(event_id) {
      return check(await sb.from("encounters").select("*").eq("event_id", event_id)) as Encounter[];
    },
    async insertEncounters(rows) {
      if (!rows.length) return 0;
      const inserted = check(
        await sb
          .from("encounters")
          .upsert(rows, { onConflict: "event_id,band_a,band_b", ignoreDuplicates: true })
          .select("band_a"),
      ) as unknown[];
      return inserted.length;
    },
    async deleteEncounters(event_id) {
      check(await sb.from("encounters").delete().eq("event_id", event_id));
    },

    async listSwipes(f) {
      let q = sb.from("swipes").select("*").eq("event_id", f.event_id);
      if (f.from_guest) q = q.eq("from_guest", f.from_guest);
      if (f.to_guest) q = q.eq("to_guest", f.to_guest);
      return check(await q) as Swipe[];
    },
    async insertSwipe(s) {
      check(await sb.from("swipes").upsert(s, { onConflict: "event_id,from_guest,to_guest" }));
    },
    async deleteSwipes(event_id) {
      check(await sb.from("swipes").delete().eq("event_id", event_id));
    },

    async listMatches(f) {
      let q = sb.from("matches").select("*");
      if (f.event_id) q = q.eq("event_id", f.event_id);
      if (f.guest_id) q = q.or(`guest_a.eq.${f.guest_id},guest_b.eq.${f.guest_id}`);
      return check(await q) as Match[];
    },
    async insertMatch(m) {
      check(await sb.from("matches").upsert(m, { onConflict: "event_id,guest_a,guest_b", ignoreDuplicates: true }));
    },

    async updateMatch(key, patch) {
      check(await sb.from("matches").update(patch).match(keyOf(key)));
    },
    async deleteMatch(key) {
      // Nachrichten hängen per ON DELETE CASCADE am Match.
      check(await sb.from("matches").delete().match(keyOf(key)));
    },

    async listMessages(key) {
      return check(await sb.from("messages").select("*").match(keyOf(key)).order("created_at")) as Message[];
    },
    async insertMessage(m) {
      return check(await sb.from("messages").insert(m).select().single()) as Message;
    },
    async deleteMessages(key) {
      check(await sb.from("messages").delete().match(keyOf(key)));
    },

    async getSettings() {
      const row = check(await sb.from("settings").select("*").eq("id", 1).maybeSingle()) as Settings | null;
      return row ?? { ...DEFAULT_SETTINGS, updated_at: new Date(0).toISOString() };
    },
    async updateSettings(patch) {
      check(
        await sb.from("settings").upsert({ id: 1, ...DEFAULT_SETTINGS, ...(await this.getSettings()), ...patch, updated_at: new Date().toISOString() }),
      );
    },

    async insertLead(l) {
      check(await sb.from("leads").insert(l));
    },
    async listLeads() {
      return check(await sb.from("leads").select("*").order("erstellt", { ascending: false })) as Lead[];
    },
  };
}
