import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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
  if (!chat) notFound();
  return (
    <GuestShell tab="matches" demo={getStore().mode === "demo"}>
      <Chat initial={chat} partnerId={partnerId} />
    </GuestShell>
  );
}
