import { NextResponse, type NextRequest } from "next/server";
import { readToken, setGuestSession } from "@/lib/session";
import { getStore } from "@/lib/store";

// Persönlicher Link: meldet den Gast auf diesem Gerät an und öffnet seine Clinks.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guestId = readToken(token);
  if (!guestId || !(await getStore().getGuest(guestId))) {
    return NextResponse.redirect(new URL("/app?link=ungueltig", req.url));
  }
  await setGuestSession(guestId);
  return NextResponse.redirect(new URL("/app", req.url));
}
