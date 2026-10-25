import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { gatewayAuth } from "@/lib/gateway";

// Firmware-Werte, die die Bänder beim nächsten Laden übernehmen.
export async function GET(req: NextRequest) {
  const denied = gatewayAuth(req);
  if (denied) return denied;
  const { schwelle_stoss, schwelle_rssi, zeitfenster_ms, updated_at } = await getStore().getSettings();
  return NextResponse.json({ schwelle_stoss, schwelle_rssi, zeitfenster_ms, updated_at });
}
