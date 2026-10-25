"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { SwipeDeck, type DeckCard } from "./SwipeDeck";
import { MatchOverlay, type MatchInfo } from "./MatchOverlay";
import { submitSwipe } from "@/app/actions";

export function GuestDeck({
  eventId,
  cards,
  me,
}: {
  eventId: string;
  cards: DeckCard[];
  me: { id: string; vorname: string; foto: string | null };
}) {
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSwipe = useCallback(
    async (card: DeckCard, richtung: "rechts" | "links") => {
      const res = await submitSwipe(eventId, card.id, richtung);
      if (!res.ok) return setError(res.error);
      if (res.match) setMatch({ id: card.id, ...res.match });
    },
    [eventId],
  );

  return (
    <>
      {error && (
        <p className="alert" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      <SwipeDeck
        cards={cards}
        onSwipe={onSwipe}
        empty={
          <div style={{ textAlign: "center", padding: "56px 8px", display: "grid", gap: 14, justifyItems: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800 }}>Alle gesehen.</p>
            <p style={{ color: "var(--mute-on-dark)", maxWidth: 300 }}>
              Wenn jemand dich auch nach rechts swipet, taucht es bei deinen Matches auf.
            </p>
            <Link href="/app/matches" className="btn btn-pink">
              Zu meinen Matches
            </Link>
          </div>
        }
      />
      {match && <MatchOverlay me={me} partner={match} onClose={() => setMatch(null)} />}
    </>
  );
}
