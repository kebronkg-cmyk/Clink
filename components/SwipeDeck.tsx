"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import styles from "./SwipeDeck.module.css";

export type DeckCard = { id: string; vorname: string; alter: number; foto: string | null; hint?: string };

type Props = {
  cards: DeckCard[];
  /** Wird nach dem Wegfliegen der Karte aufgerufen. */
  onSwipe: (card: DeckCard, richtung: "rechts" | "links") => void | Promise<void>;
  empty?: React.ReactNode;
  compact?: boolean;
  /** Pfeiltasten links/rechts swipen (aus, wenn das Deck nur eine Demo auf einer langen Seite ist). */
  keyboard?: boolean;
};

const THRESHOLD = 110; // px, ab hier zählt der Swipe

export function SwipeDeck({ cards, onSwipe, empty, compact = false, keyboard = true }: Props) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<null | "rechts" | "links">(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const busy = useRef(false);

  const card = cards[index];
  const next = cards[index + 1];

  const fly = useCallback(
    (richtung: "rechts" | "links") => {
      if (!card || busy.current) return;
      busy.current = true;
      setLeaving(richtung);
      if (richtung === "rechts" && "vibrate" in navigator) navigator.vibrate?.(30);
      window.setTimeout(async () => {
        try {
          await onSwipe(card, richtung);
        } finally {
          setIndex((i) => i + 1);
          setLeaving(null);
          setDrag({ x: 0, y: 0, active: false });
          busy.current = false;
        }
      }, 280);
    },
    [card, onSwipe],
  );

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") fly("rechts");
      if (e.key === "ArrowLeft") fly("links");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fly, keyboard]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    if (drag.x > THRESHOLD) fly("rechts");
    else if (drag.x < -THRESHOLD) fly("links");
    else setDrag({ x: 0, y: 0, active: false });
  };

  if (!card) return <div className={styles.empty}>{empty}</div>;

  const x = leaving === "rechts" ? 700 : leaving === "links" ? -700 : drag.x;
  const y = leaving ? drag.y + 40 : drag.y * 0.3;
  const rot = x / 18;
  const yes = Math.max(0, Math.min(1, x / THRESHOLD));
  const no = Math.max(0, Math.min(1, -x / THRESHOLD));

  return (
    <div className={`${styles.deck} ${compact ? styles.compact : ""}`}>
      <div className={styles.stack}>
        {next && (
          <div className={`${styles.card} ${styles.behind}`} aria-hidden="true">
            <Avatar fill name={next.vorname} foto={next.foto} id={next.id} radius={0} />
          </div>
        )}
        <div
          key={card.id}
          className={styles.card}
          style={{
            transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
            transition: drag.active && !leaving ? "none" : "transform 0.28s cubic-bezier(.2,.8,.3,1)",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Avatar fill name={card.vorname} foto={card.foto} id={card.id} radius={0} />
          <div className={styles.shade} />
          <div className={styles.meta}>
            <p className={styles.name}>
              {card.vorname} <span>{card.alter}</span>
            </p>
            {card.hint && <p className={styles.hint}>{card.hint}</p>}
          </div>
          <span className={`${styles.stamp} ${styles.stampYes}`} style={{ opacity: yes }}>
            CLINK
          </span>
          <span className={`${styles.stamp} ${styles.stampNo}`} style={{ opacity: no }}>
            WEITER
          </span>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${styles.round} ${styles.nope}`} onClick={() => fly("links")} aria-label="Nach links swipen: kein Interesse">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
        <p className={styles.count}>
          {index + 1} / {cards.length}
        </p>
        <button type="button" className={`${styles.round} ${styles.like}`} onClick={() => fly("rechts")} aria-label="Nach rechts swipen: Interesse">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path
              d="M12 20.5s-7.5-4.6-9.3-9.6C1.4 7.3 3.7 4 7.1 4c2 0 3.5 1.1 4.9 2.9C13.4 5.1 14.9 4 16.9 4c3.4 0 5.7 3.3 4.4 6.9-1.8 5-9.3 9.6-9.3 9.6z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
