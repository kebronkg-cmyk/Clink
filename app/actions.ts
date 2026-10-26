"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { DEMO_GUEST_ID, resetDemoGuest } from "@/lib/store/memory";
import { MIN_AGE } from "@/lib/config";
import {
  checkin,
  getChat,
  normalizeInstagram,
  sendMessage,
  swipe,
  unmatch,
  voteExtend,
  type ChatResult,
  type ChatView,
  type SwipeResult,
} from "@/lib/service";
import { clearGuestSession, getGuestId, setGuestSession } from "@/lib/session";

export type FormState = { error?: string; ok?: boolean } | null;

const text = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? "").trim().slice(0, max);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---------- Kontaktformular "CLINK für deinen Club" ----------

export async function submitLead(_prev: FormState, fd: FormData): Promise<FormState> {
  if (text(fd, "website")) return { ok: true }; // Honeypot gegen Spam-Bots
  const lead = {
    name: text(fd, "name", 120),
    location: text(fd, "location", 120),
    stadt: text(fd, "stadt", 80),
    email: text(fd, "email", 160),
    nachricht: text(fd, "nachricht", 2000),
  };
  if (!lead.name || !lead.location || !lead.stadt) return { error: "Bitte Name, Location und Stadt angeben." };
  if (!isEmail(lead.email)) return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  if (fd.get("einwilligung") !== "on") return { error: "Bitte der Verarbeitung deiner Anfrage zustimmen." };
  await getStore().insertLead(lead);
  return { ok: true };
}

// ---------- Check-in ----------

export async function submitCheckin(_prev: FormState, fd: FormData): Promise<FormState> {
  const vorname = text(fd, "vorname", 40);
  const alter = Number(text(fd, "alter", 3));
  const instagramRaw = text(fd, "instagram", 80);
  const instagram = normalizeInstagram(instagramRaw);
  const email = text(fd, "email", 160);

  if (!text(fd, "band", 40)) return { error: "Bitte die Nummer deines Bands eingeben." };
  if (!vorname) return { error: "Bitte deinen Vornamen angeben." };
  if (!Number.isInteger(alter) || alter < MIN_AGE || alter > 99) return { error: `CLINK gibt es ab ${MIN_AGE}. Bitte ein gültiges Alter angeben.` };
  if (instagramRaw && !instagram) return { error: "Der Instagram-Name sieht nicht gültig aus." };
  if (email && !isEmail(email)) return { error: "Die E-Mail-Adresse sieht nicht gültig aus." };
  if (fd.get("volljaehrig") !== "on") return { error: `Bitte bestätige, dass du mindestens ${MIN_AGE} bist.` };
  if (fd.get("datenschutz") !== "on") return { error: "Bitte stimme der Speicherung deiner Begegnungen zu." };

  let foto: { data: Uint8Array; type: string } | null = null;
  const file = fd.get("foto");
  if (file instanceof File && file.size > 0) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: "Bitte ein Foto als JPG, PNG oder WebP." };
    if (file.size > 3_000_000) return { error: "Das Foto ist zu groß (max. 3 MB)." };
    foto = { data: new Uint8Array(await file.arrayBuffer()), type: file.type };
  }

  const res = await checkin(
    {
      bandId: text(fd, "band", 40),
      vorname,
      alter,
      instagram,
      instagramFreigabe: fd.get("instagram_freigabe") === "on",
      email: email || null,
      foto,
    },
    await getGuestId(),
  );
  if (!res.ok) return { error: res.error };
  await setGuestSession(res.guestId);
  redirect("/checkin/fertig");
}

// ---------- Gast-Bereich ----------

export async function submitSwipe(eventId: string, toGuest: string, richtung: "rechts" | "links"): Promise<SwipeResult> {
  const guestId = await getGuestId();
  if (!guestId) return { ok: false, error: "Deine Sitzung ist abgelaufen." };
  return swipe(guestId, eventId, toGuest, richtung);
}

// ---------- Chat ----------

export async function loadChat(eventId: string, partnerId: string): Promise<ChatView | null> {
  const guestId = await getGuestId();
  return guestId ? getChat(guestId, eventId, partnerId) : null;
}

export async function sendChatMessage(
  eventId: string,
  partnerId: string,
  input: { karte: string } | { text: string },
): Promise<ChatResult> {
  const guestId = await getGuestId();
  if (!guestId) return { ok: false, error: "Deine Sitzung ist abgelaufen." };
  const res = await sendMessage(guestId, eventId, partnerId, input);
  if (res.ok && getStore().mode === "demo" && partnerId.startsWith("demo-")) await demoReply(guestId, eventId, partnerId);
  return res;
}

/** Demo-Modus: Die Beispiel-Person antwortet einmal mit einer Karte, damit sich der Chat lebendig anfühlt. */
async function demoReply(guestId: string, eventId: string, partnerId: string) {
  const chat = await getChat(guestId, eventId, partnerId);
  if (!chat || chat.nachrichten.some((m) => !m.vonMir)) return;
  const replies = ["wieder-naechster", "tanz-seit", "abend-gesucht", "humor-wer"];
  await sendMessage(partnerId, eventId, guestId, { karte: replies[chat.partner.vorname.length % replies.length] });
}

export async function extendChat(eventId: string, partnerId: string) {
  const guestId = await getGuestId();
  if (!guestId) return { ok: false as const, error: "Deine Sitzung ist abgelaufen." };
  return voteExtend(guestId, eventId, partnerId);
}

export async function unmatchAction(eventId: string, partnerId: string) {
  const guestId = await getGuestId();
  if (guestId) await unmatch(guestId, eventId, partnerId);
  redirect("/app/matches");
}

export async function deleteProfile() {
  const guestId = await getGuestId();
  if (guestId) await getStore().deleteGuest(guestId);
  await clearGuestSession();
  redirect("/?geloescht=1");
}

export async function logoutGuest() {
  await clearGuestSession();
  redirect("/");
}

/** Nur im Demo-Modus: als Beispiel-Gast einloggen, um Swipen auszuprobieren. */
export async function startDemo() {
  if (getStore().mode !== "demo") redirect("/");
  resetDemoGuest();
  await setGuestSession(DEMO_GUEST_ID);
  redirect("/app");
}
