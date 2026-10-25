import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/** Prüft `Authorization: Bearer <GATEWAY_TOKEN>`. Gibt bei Fehler eine Antwort zurück. */
export function gatewayAuth(req: NextRequest): NextResponse | null {
  const token = process.env.GATEWAY_TOKEN ?? (process.env.NODE_ENV === "production" ? "" : "dev-gateway");
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = token && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));
  return ok ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
