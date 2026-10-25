"use client";

import { useEffect } from "react";
import { Avatar } from "./Avatar";
import styles from "./MatchOverlay.module.css";

export type MatchInfo = { id: string; vorname: string; foto: string | null; instagram: string | null };

export function MatchOverlay({
  me,
  partner,
  onClose,
}: {
  me: { id: string; vorname: string; foto: string | null };
  partner: MatchInfo;
  onClose: () => void;
}) {
  useEffect(() => {
    navigator.vibrate?.([70, 50, 70, 50, 140]);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="match-title">
      <div className={styles.burst} aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
        ))}
      </div>
      <div className={styles.inner}>
        <p className="eyebrow">Gegenseitig</p>
        <h2 id="match-title" className={styles.title}>
          CLINK!
        </h2>
        <p className={styles.sub}>Du und {partner.vorname} wollt euch wiedersehen.</p>
        <div className={styles.pair}>
          <div className={`${styles.face} ${styles.left}`}>
            <Avatar name={me.vorname} foto={me.foto} id={me.id} size={124} />
          </div>
          <div className={`${styles.face} ${styles.right}`}>
            <Avatar name={partner.vorname} foto={partner.foto} id={partner.id} size={124} />
          </div>
        </div>
        {partner.instagram ? (
          <a className="btn btn-pink" href={`https://instagram.com/${partner.instagram}`} target="_blank" rel="noreferrer">
            @{partner.instagram} auf Instagram
          </a>
        ) : (
          <p className={styles.sub}>{partner.vorname} hat kein Instagram freigegeben. Vielleicht beim nächsten Abend?</p>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Weiter swipen
        </button>
      </div>
    </div>
  );
}
