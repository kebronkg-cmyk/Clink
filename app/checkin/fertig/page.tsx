import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestShell } from "@/components/GuestShell";
import { ClinkStage } from "@/components/ClinkStage";
import { CopyLink } from "@/components/CopyLink";
import { getStore } from "@/lib/store";
import { SITE_URL } from "@/lib/config";
import { getGuestId, guestLinkToken } from "@/lib/session";

export const metadata: Metadata = { title: "Du bist drin" };
export const dynamic = "force-dynamic";

export default async function CheckinDone() {
  const guestId = await getGuestId();
  if (!guestId) redirect("/checkin");
  const store = getStore();
  const guest = await store.getGuest(guestId);
  if (!guest) redirect("/checkin");
  const event = (await store.listEvents()).find((e) => e.is_active);
  const checkin = event ? (await store.listCheckins({ event_id: event.id, guest_id: guestId }))[0] : undefined;
  const link = `${SITE_URL}/l/${guestLinkToken(guestId)}`;

  return (
    <GuestShell demo={store.mode === "demo"}>
      <p className="eyebrow">Check-in fertig</p>
      <h1 style={{ fontSize: "clamp(40px, 12vw, 60px)", marginTop: 10 }}>
        Du bist drin, <span style={{ color: "var(--pink)" }}>{guest.vorname}</span>!
      </h1>
      {checkin && (
        <p style={{ marginTop: 12, color: "var(--mute-on-dark)" }}>
          Band <strong style={{ color: "var(--cream)", letterSpacing: "0.06em" }}>{checkin.band_id}</strong> gehört heute dir.
        </p>
      )}
      <div style={{ margin: "26px 0 10px" }}>
        <ClinkStage />
      </div>
      <ol style={{ display: "grid", gap: 14, paddingLeft: 22, margin: "0 0 28px" }}>
        <li>
          <strong>Handy weg.</strong> Ab jetzt brauchst du es nicht mehr.
        </li>
        <li>
          <strong>Anstoßen.</strong> Handgelenk an Handgelenk. Vibriert es bei beiden, ist die Begegnung gespeichert.
        </li>
        <li>
          <strong>Band abgeben</strong> beim Rausgehen.
        </li>
        <li>
          <strong>Morgen swipen.</strong> Mit deinem persönlichen Link unten.
        </li>
      </ol>
      <div className="notice" style={{ display: "grid", gap: 12 }}>
        <p>
          <strong>Dein persönlicher Link für morgen.</strong> Speicher ihn dir oder leg CLINK auf den Homescreen. Teil ihn mit niemandem.
        </p>
        <CopyLink url={link} />
      </div>
      <p style={{ marginTop: 24, textAlign: "center" }}>
        <Link href="/app" style={{ color: "var(--mute-on-dark)" }}>
          Zu meinen Clinks
        </Link>
      </p>
    </GuestShell>
  );
}
