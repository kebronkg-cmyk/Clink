import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Signierte Cookies statt Login: Der Gast bekommt beim Check-in eine Sitzung,
// der Admin nach Eingabe des Passworts.

const GUEST_COOKIE = "clink_gast";
const ADMIN_COOKIE = "clink_admin";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET fehlt");
  return "nur-fuer-die-entwicklung";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Token der Form `<wert>.<ablauf>.<signatur>` */
export function createToken(value: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${value}.${exp}`;
  return `${body}.${sign(body)}`;
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [value, exp, sig] = parts;
  const expected = Buffer.from(sign(`${value}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return value;
}

const GUEST_TTL = 14 * 24 * 3600; // Sitzung überdauert die Swipe-Frist

export async function getGuestId(): Promise<string | null> {
  return readToken((await cookies()).get(GUEST_COOKIE)?.value);
}

export async function setGuestSession(guestId: string) {
  (await cookies()).set(GUEST_COOKIE, createToken(guestId, GUEST_TTL), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: GUEST_TTL,
    path: "/",
  });
}

export async function clearGuestSession() {
  (await cookies()).delete(GUEST_COOKIE);
}

/** Persönlicher Link für den nächsten Tag (per Mail/SMS oder zum Speichern). */
export function guestLinkToken(guestId: string): string {
  return createToken(guestId, GUEST_TTL);
}

export async function isAdmin(): Promise<boolean> {
  return readToken((await cookies()).get(ADMIN_COOKIE)?.value) === "admin";
}

export async function setAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, createToken("admin", 12 * 3600), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 3600,
    path: "/",
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export function checkAdminPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "clink");
  if (!pw) return false;
  const a = Buffer.from(sign(input));
  const b = Buffer.from(sign(pw));
  return timingSafeEqual(a, b);
}
