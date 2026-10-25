import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { normalizeBandId } from "@/lib/service";
import { gatewayAuth } from "@/lib/gateway";

// Gateway meldet Bandstatus: [{ id, mac?, akku? }]. Setzt "letzter Kontakt" auf jetzt.
export async function POST(req: NextRequest) {
  const denied = gatewayAuth(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Array<{ id: string; mac?: string; akku?: number }> | null;
  if (!Array.isArray(body)) return NextResponse.json({ error: "Liste erwartet" }, { status: 400 });
  const now = new Date().toISOString();
  const rows = body
    .filter((b) => typeof b?.id === "string" && b.id.trim())
    .map((b) => ({
      id: normalizeBandId(b.id),
      last_seen: now,
      ...(b.mac ? { mac: String(b.mac).replace(/[:-]/g, "").toUpperCase() } : {}),
      ...(typeof b.akku === "number" ? { akku: Math.max(0, Math.min(100, Math.round(b.akku))) } : {}),
    }));
  await getStore().upsertBands(rows);
  return NextResponse.json({ updated: rows.length });
}
