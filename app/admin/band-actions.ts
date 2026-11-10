"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/store";
import { DANCE_DEFAULTS } from "@/lib/config";
import { importEncounters, isOpen, type ImportResult } from "@/lib/service";
import { isAdmin } from "@/lib/session";
import type { BandParams, BandRecord } from "@/lib/band-protocol";

// Serverseite des Auslesens: Schlüssel bleiben auf dem Server, der Browser
// bekommt nur die Antwort auf die Anmelde-Frage des Bandes.

function masterKey(): string {
  const k = process.env.BAND_MASTER_KEY;
  if (k) return k;
  if (process.env.NODE_ENV === "production") throw new Error("BAND_MASTER_KEY fehlt");
  return "nur-fuer-die-entwicklung-band";
}

const le32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};

/** Eigener Schlüssel pro Band, abgeleitet aus dem Hauptschlüssel. */
function bandKey(bandId: number): Buffer {
  return createHmac("sha256", masterKey()).update("CLINK-BAND-KEY").update(le32(bandId)).digest();
}

async function guard() {
  if (!(await isAdmin())) throw new Error("Nicht angemeldet");
}

const validId = (id: number) => Number.isInteger(id) && id > 0 && id <= 0xffffffff;

/** Antwort auf die Anmelde-Frage (Nonce) des Bandes. */
export async function bandAuth(bandId: number, nonceHex: string): Promise<string> {
  await guard();
  if (!validId(bandId) || !/^[0-9a-f]{32}$/.test(nonceHex)) throw new Error("Ungültige Anfrage");
  return createHmac("sha256", bandKey(bandId))
    .update("CLINK-AUTH")
    .update(Buffer.from(nonceHex, "hex"))
    .update(le32(bandId))
    .digest("hex");
}

/** Neues Band einrichten: Schlüssel für die Geräte-ID vom Aufkleber. */
export async function bandProvision(bandId: number, mac: string | null): Promise<string> {
  await guard();
  if (!validId(bandId)) throw new Error("Geräte-ID muss eine Zahl sein, z. B. 778775");
  await getStore().upsertBands([{ id: String(bandId), ...(mac ? { mac } : {}), last_seen: new Date().toISOString() }]);
  revalidatePath("/admin");
  return bandKey(bandId).toString("hex");
}

/** Aktuelle Firmware-Werte aus dem Admin, so wie das Band sie erwartet. */
export async function bandParams(): Promise<BandParams> {
  await guard();
  const s = await getStore().getSettings();
  return {
    shockMg: Math.round(s.schwelle_stoss * 1000),
    clinkRssi: Math.round(s.schwelle_rssi),
    windowMs: Math.round(s.zeitfenster_ms),
    ...DANCE_DEFAULTS,
  };
}

export type ReadoutResult = ImportResult & { event: string; ungenau: number };

/**
 * Begegnungen eines Bandes übernehmen. Zeitstempel: Das Band kennt nur seine
 * Laufzeit seit dem Start; daraus und der Auslesezeit wird die Uhrzeit berechnet.
 * Einträge aus einem früheren Start (Akku leer) bekommen die Auslesezeit.
 */
export async function bandImport(input: {
  eventId: string;
  bandId: number;
  boot: number;
  uptimeS: number;
  batteryPct: number;
  records: BandRecord[];
}): Promise<ReadoutResult> {
  await guard();
  const store = getStore();
  const event = await store.getEvent(input.eventId);
  if (!event) throw new Error("Event nicht gefunden");
  if (!validId(input.bandId)) throw new Error("Ungültige Band-ID");

  const now = Date.now();
  let ungenau = 0;
  const rows = input.records
    .filter((r) => validId(r.peer) && r.peer !== input.bandId)
    .map((r) => {
      const sameBoot = r.boot === input.boot && r.tS <= input.uptimeS;
      if (!sameBoot) ungenau++;
      const ts = sameBoot ? now - (input.uptimeS - r.tS) * 1000 : now;
      return { a: String(input.bandId), b: String(r.peer), ts: new Date(ts).toISOString() };
    });

  const result = await importEncounters(event.id, { rows, errors: [] });
  await store.upsertBands([
    { id: String(input.bandId), akku: Math.max(0, Math.min(100, Math.round(input.batteryPct))), last_seen: new Date().toISOString() },
  ]);
  revalidatePath("/admin");
  return { ...result, event: event.name, ungenau };
}

/** Events, in die ausgelesen werden kann: aktives zuerst, dann noch offene. */
export async function readoutEvents(): Promise<Array<{ id: string; label: string }>> {
  await guard();
  const events = await getStore().listEvents();
  return events
    .filter((e) => e.is_active || isOpen(e))
    .sort((a, b) => Number(b.is_active) - Number(a.is_active))
    .map((e) => ({ id: e.id, label: `${e.name} · ${e.datum}` }));
}
