import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GuestShell } from "@/components/GuestShell";
import { Avatar } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { getStore } from "@/lib/store";
import { guestMatches } from "@/lib/service";
import { getGuestId } from "@/lib/session";
import styles from "../guest.module.css";

export const metadata: Metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const guestId = await getGuestId();
  if (!guestId) redirect("/app");
  const store = getStore();
  const matches = await guestMatches(guestId);

  return (
    <GuestShell tab="matches" demo={store.mode === "demo"}>
      <p className="eyebrow">Gegenseitig</p>
      <h1 className={styles.title}>{matches.length ? (matches.length === 1 ? "1 Match" : `${matches.length} Matches`) : "Noch keine Matches"}</h1>
      {matches.length === 0 ? (
        <>
          <p className={styles.text}>Ein Match entsteht, wenn ihr euch beide nach rechts swipet. Vielleicht wartet ja noch jemand auf deinen Swipe.</p>
          <Link href="/app" className="btn btn-pink" style={{ marginTop: 24 }}>
            Zu meinen Clinks
          </Link>
        </>
      ) : (
        <>
          <p className={styles.text}>Ihr wolltet euch beide wiedersehen. Jetzt seid ihr dran.</p>
          <ul className={styles.list}>
            {matches.map((m) => (
              <li key={m.chat}>
                <Link href={m.chat} className={styles.match}>
                  <Avatar name={m.vorname} foto={m.foto} id={m.id} size={60} />
                  <div className={styles.matchBody}>
                    <p className={styles.matchName}>
                      {m.vorname} <span style={{ fontWeight: 400, color: "var(--mute-on-dark)" }}>{m.alter}</span>
                    </p>
                    <p className={styles.preview}>
                      {!m.chatOffen
                        ? m.instagram
                          ? `Chat abgelaufen · @${m.instagram}`
                          : "Chat abgelaufen"
                        : m.letzte
                          ? `${m.letzte.vonMir ? "Du: " : ""}${m.letzte.text}`
                          : "🥂 Schick den ersten Clink"}
                    </p>
                  </div>
                  <span className={styles.matchSide}>
                    {m.chatOffen && m.letzte && !m.letzte.vonMir && <span className={styles.dot} aria-label="Neue Nachricht" />}
                    {m.chatOffen && <Countdown until={m.chatUntil} />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.small} style={{ marginTop: 20 }}>
            Jeder Chat ist 72 Stunden offen. Wollt ihr beide weiterschreiben, verlängert ihn gemeinsam.
          </p>
        </>
      )}
    </GuestShell>
  );
}
