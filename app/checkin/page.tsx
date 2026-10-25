import type { Metadata } from "next";
import { CheckinForm } from "@/components/CheckinForm";
import { GuestShell } from "@/components/GuestShell";
import { getStore } from "@/lib/store";
import { normalizeBandId } from "@/lib/service";
import { getGuestId } from "@/lib/session";

export const metadata: Metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ band?: string }> }) {
  const { band = "" } = await searchParams;
  const store = getStore();
  const event = (await store.listEvents()).find((e) => e.is_active) ?? null;
  const guestId = await getGuestId();
  const guest = guestId ? await store.getGuest(guestId) : null;

  return (
    <GuestShell demo={store.mode === "demo"}>
      <p className="eyebrow">Check-in</p>
      <h1 style={{ fontSize: "clamp(36px, 10vw, 52px)", marginTop: 10 }}>
        {guest ? (
          <>
            Schön, dass du wieder da bist, <span style={{ color: "var(--pink)" }}>{guest.vorname}</span>.
          </>
        ) : (
          <>
            Band an. <span style={{ color: "var(--pink)" }}>Los geht&apos;s.</span>
          </>
        )}
      </h1>
      {event ? (
        <p style={{ margin: "12px 0 28px", color: "var(--mute-on-dark)" }}>
          Heute: <strong style={{ color: "var(--cream)" }}>{event.name}</strong> · {event.location}
        </p>
      ) : (
        <p className="notice" style={{ margin: "16px 0 28px" }}>
          Gerade läuft kein CLINK-Abend. Der Check-in öffnet, sobald das Personal den Abend startet.
        </p>
      )}
      <CheckinForm
        band={normalizeBandId(band)}
        prefill={
          guest
            ? {
                vorname: guest.vorname,
                alter: guest.alter,
                instagram: guest.instagram,
                freigabe: guest.instagram_freigabe,
                email: guest.email,
                foto: guest.foto,
              }
            : null
        }
      />
    </GuestShell>
  );
}
