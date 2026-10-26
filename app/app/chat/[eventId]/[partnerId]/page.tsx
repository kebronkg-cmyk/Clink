import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestShell } from "@/components/GuestShell";
import { Chat } from "@/components/Chat";
import { getStore } from "@/lib/store";
import { getChat } from "@/lib/service";
import { getGuestId } from "@/lib/session";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ eventId: string; partnerId: string }> }) {
  const { eventId, partnerId } = await params;
  const guestId = await getGuestId();
  if (!guestId) redirect("/app");
  const chat = await getChat(guestId, eventId, partnerId);
  const demo = getStore().mode === "demo";
  if (!chat) {
    return (
      <GuestShell tab="matches" demo={demo}>
        <p className="eyebrow">Chat</p>
        <h1 style={{ fontSize: "clamp(32px, 9vw, 44px)", marginTop: 10 }}>Diesen Chat gibt es nicht mehr.</h1>
        <p style={{ marginTop: 14, color: "var(--mute-on-dark)" }}>
          {demo
            ? "Im Demo-Modus liegen die Daten nur kurz im Speicher des Servers und können zwischendurch verloren gehen. Mit angeschlossener Datenbank passiert das nicht."
            : "Das Match wurde aufgelöst oder ist nicht mehr verfügbar."}
        </p>
        <Link href="/app/matches" className="btn btn-pink" style={{ marginTop: 24 }}>
          Zu meinen Matches
        </Link>
      </GuestShell>
    );
  }
  return (
    <GuestShell tab="matches" demo={demo}>
      <Chat initial={chat} partnerId={partnerId} />
    </GuestShell>
  );
}
