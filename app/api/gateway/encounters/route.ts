import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { importEncounters, isOpen, parseEncounterCsv } from "@/lib/service";
import { gatewayAuth } from "@/lib/gateway";

// Gateway am Ladeschrank lädt Begegnungen hoch.
// Body: CSV (band_a,band_b,timestamp) oder JSON { encounters: [{ band_a, band_b, timestamp }] }.
// Event: ?event_id=… oder automatisch das aktive bzw. jüngste noch offene Event.
export async function POST(req: NextRequest) {
  const denied = gatewayAuth(req);
  if (denied) return denied;

  const store = getStore();
  const events = await store.listEvents();
  const wanted = req.nextUrl.searchParams.get("event_id");
  const event = wanted ? events.find((e) => e.id === wanted) : (events.find((e) => e.is_active) ?? events.find((e) => isOpen(e)));
  if (!event) return NextResponse.json({ error: "kein passendes Event" }, { status: 404 });

  let csv: string;
  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { encounters?: Array<{ band_a: string; band_b: string; timestamp: string }> } | null;
    if (!Array.isArray(body?.encounters)) return NextResponse.json({ error: "encounters fehlt" }, { status: 400 });
    csv = body.encounters.map((e) => `${e.band_a},${e.band_b},${e.timestamp}`).join("\n");
  } else {
    csv = await req.text();
  }

  const result = await importEncounters(event.id, parseEncounterCsv(csv));
  return NextResponse.json({ event_id: event.id, ...result });
}
