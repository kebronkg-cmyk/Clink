"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { swipeUntilFor } from "@/lib/config";
import { importEncounters, normalizeBandId, parseEncounterCsv, purgeExpired, type ImportResult } from "@/lib/service";
import { checkAdminPassword, clearAdminSession, isAdmin, setAdminSession } from "@/lib/session";

async function guard() {
  if (!(await isAdmin())) redirect("/admin");
}

const text = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? "").trim().slice(0, max);

export async function login(_prev: { error?: string } | null, fd: FormData) {
  if (!checkAdminPassword(String(fd.get("password") ?? ""))) return { error: "Falsches Passwort." };
  await setAdminSession();
  redirect("/admin");
}

export async function logout() {
  await clearAdminSession();
  redirect("/admin");
}

// ---------- Events ----------

export async function createEvent(fd: FormData) {
  await guard();
  const name = text(fd, "name", 120);
  const datum = text(fd, "datum", 10);
  const location = text(fd, "location", 160);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || !location) return;
  const store = getStore();
  const ev = await store.insertEvent({ name, datum, location, is_active: false, swipe_until: swipeUntilFor(datum) });
  if (fd.get("aktiv") === "on") await store.setActiveEvent(ev.id);
  revalidatePath("/admin");
}

export async function activateEvent(id: string | null) {
  await guard();
  await getStore().setActiveEvent(id);
  revalidatePath("/admin");
}

export async function extendEvent(id: string, hours: number) {
  await guard();
  const store = getStore();
  const ev = await store.getEvent(id);
  if (!ev) return;
  const base = Math.max(Date.now(), new Date(ev.swipe_until).getTime());
  await store.updateEvent(id, { swipe_until: new Date(base + hours * 3600_000).toISOString() });
  revalidatePath("/admin");
}

export async function releaseCheckin(eventId: string, bandId: string) {
  await guard();
  await getStore().deleteCheckin(eventId, bandId);
  revalidatePath("/admin");
}

// ---------- Bänder ----------

/** Eine Zeile pro Band: `Geräte-ID[,MAC]`, z. B. `778775,BC57292696C9`. */
export async function addBands(fd: FormData) {
  await guard();
  const rows = text(fd, "bands", 20000)
    .split(/\r?\n/)
    .map((l) => l.split(/[,;\t ]+/).filter(Boolean))
    .filter((c) => c.length && !/^id$/i.test(c[0]))
    .map(([id, mac]) => ({ id: normalizeBandId(id), ...(mac ? { mac: mac.replace(/[:-]/g, "").toUpperCase() } : {}) }))
    .filter((b) => /^[A-Z0-9-]{3,32}$/.test(b.id));
  await getStore().upsertBands(rows);
  revalidatePath("/admin");
}

// ---------- Import ----------

export type ImportState = { result?: ImportResult; error?: string } | null;

export async function importCsv(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await guard();
  const eventId = text(fd, "event_id", 80);
  if (!(await getStore().getEvent(eventId))) return { error: "Bitte ein Event wählen." };
  const file = fd.get("datei");
  let csv = text(fd, "csv", 2_000_000);
  if (file instanceof File && file.size > 0) csv = await file.text();
  if (!csv) return { error: "Bitte eine CSV-Datei wählen oder Zeilen einfügen." };
  const result = await importEncounters(eventId, parseEncounterCsv(csv));
  revalidatePath("/admin");
  return { result };
}

// ---------- Einstellungen ----------

export async function saveSettings(fd: FormData) {
  await guard();
  const num = (k: string) => Number(String(fd.get(k) ?? "").replace(",", "."));
  const schwelle_stoss = num("schwelle_stoss");
  const schwelle_rssi = num("schwelle_rssi");
  const zeitfenster_ms = num("zeitfenster_ms");
  if (!(schwelle_stoss > 0 && schwelle_stoss <= 16)) return;
  if (!(schwelle_rssi <= 0 && schwelle_rssi >= -100)) return;
  if (!(zeitfenster_ms >= 10 && zeitfenster_ms <= 2000)) return;
  await getStore().updateSettings({ schwelle_stoss, schwelle_rssi: Math.round(schwelle_rssi), zeitfenster_ms: Math.round(zeitfenster_ms) });
  revalidatePath("/admin");
}

export async function runPurge() {
  await guard();
  await purgeExpired();
  revalidatePath("/admin");
}
