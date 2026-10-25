import type { Metadata } from "next";
import Link from "next/link";
import { GuestShell } from "@/components/GuestShell";
import { GuestDeck } from "@/components/GuestDeck";
import { Countdown } from "@/components/Countdown";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteProfile, logoutGuest, startDemo } from "@/app/actions";
import { getStore } from "@/lib/store";
import { guestEvents, purgeExpired } from "@/lib/service";
import { getGuestId } from "@/lib/session";
import styles from "./guest.module.css";

export const metadata: Metadata = { title: "Meine Clinks" };
export const dynamic = "force-dynamic";

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export default async function GuestHome({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  const store = getStore();
  const demo = store.mode === "demo";
  const guestId = await getGuestId();
  const guest = guestId ? await store.getGuest(guestId) : null;

  if (!guest) {
    return (
      <GuestShell demo={demo}>
        <p className="eyebrow">Meine Clinks</p>
        <h1 className={styles.title}>Noch nicht eingecheckt?</h1>
        {link === "ungueltig" && (
          <p className="alert" style={{ marginTop: 18 }}>
            Dieser Link ist abgelaufen oder ungültig.
          </p>
        )}
        <p className={styles.text}>
          Deine Clinks findest du über deinen persönlichen Link vom Check-in, auf dem Gerät, mit dem du eingecheckt hast.
        </p>
        <div className={styles.stack}>
          <Link href="/checkin" className="btn btn-pink">
            Band einchecken
          </Link>
          {demo && (
            <form action={startDemo}>
              <button className="btn btn-ghost" style={{ width: "100%" }}>
                Demo ausprobieren
              </button>
            </form>
          )}
        </div>
      </GuestShell>
    );
  }

  await purgeExpired();
  const views = await guestEvents(guest.id);
  const current = views.find((v) => v.open && v.offen.length) ?? views.find((v) => v.open) ?? views[0];
  const others = views.filter((v) => v !== current && v.open && v.offen.length);

  return (
    <GuestShell tab="clinks" demo={demo}>
      {!current ? (
        <>
          <h1 className={styles.title}>Hey {guest.vorname}!</h1>
          <p className={styles.text}>Du hast noch an keinem CLINK-Abend teilgenommen. Check dich am Eingang mit deinem Band ein.</p>
        </>
      ) : !current.open ? (
        <>
          <p className="eyebrow">{current.event.name}</p>
          <h1 className={styles.title}>Die Swipe-Zeit ist vorbei.</h1>
          <p className={styles.text}>Begegnungen und Swipes dieses Abends sind gelöscht. Deine Matches bleiben.</p>
          <Link href="/app/matches" className="btn btn-pink" style={{ marginTop: 24 }}>
            Zu meinen Matches
          </Link>
        </>
      ) : !current.importiert ? (
        <>
          <p className="eyebrow">{current.event.name}</p>
          <h1 className={styles.title}>{current.event.is_active ? "Heute Abend läuft noch." : "Gleich geht's los."}</h1>
          <p className={styles.text}>
            {current.event.is_active
              ? "Handy weg, anstoßen, tanzen. Sobald dein Band im Ladeschrank war, erscheinen deine Clinks hier."
              : "Die Bänder werden gerade ausgelesen. Schau in ein paar Stunden nochmal vorbei."}
          </p>
        </>
      ) : (
        <>
          <div className={styles.head}>
            <div>
              <p className="eyebrow">{current.event.name}</p>
              <h1 className={styles.titleSm}>
                {current.begegnungen === 1 ? "1 Clink" : `${current.begegnungen} Clinks`}
              </h1>
            </div>
            <p className={styles.timer}>
              <Countdown until={current.event.swipe_until} />
            </p>
          </div>
          <GuestDeck
            eventId={current.event.id}
            me={{ id: guest.id, vorname: guest.vorname, foto: guest.foto }}
            cards={current.offen.map((p) => ({ ...p, hint: `Geclinkt um ${timeOf(p.zeit)}` }))}
          />
        </>
      )}

      {others.length > 0 && (
        <p className={styles.text} style={{ textAlign: "center" }}>
          Von {others.map((o) => o.event.name).join(", ")} warten auch noch Clinks. Swipe erst diesen Abend fertig.
        </p>
      )}

      <details className={styles.settings}>
        <summary>Mein Profil</summary>
        <p>
          Eingecheckt als <strong>{guest.vorname}</strong>, {guest.alter}
          {guest.instagram ? ` · @${guest.instagram}${guest.instagram_freigabe ? " (nach Match sichtbar)" : " (nicht freigegeben)"}` : ""}
        </p>
        <div className={styles.row}>
          <form action={logoutGuest}>
            <button className="btn btn-ghost">Abmelden</button>
          </form>
          <form action={deleteProfile}>
            <ConfirmButton message="Profil und alle Daten endgültig löschen?" style={{ borderColor: "var(--no)", color: "#ffc9c9" }}>
              Profil löschen
            </ConfirmButton>
          </form>
        </div>
        <p className={styles.small}>Löschen entfernt Profil, Foto, Begegnungen, Swipes und Matches sofort und endgültig.</p>
      </details>
    </GuestShell>
  );
}
