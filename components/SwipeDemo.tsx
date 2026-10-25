"use client";

import { useCallback, useState } from "react";
import { SwipeDeck, type DeckCard } from "./SwipeDeck";
import { MatchOverlay, type MatchInfo } from "./MatchOverlay";

// Spielwiese auf der Landing-Page: erfundene Begegnungen, keine echten Daten.
const DEMO: Array<DeckCard & { likesBack: boolean; instagram: string | null }> = [
  { id: "lp-lena", vorname: "Lena", alter: 26, foto: null, hint: "Geclinkt um 23:41 · Bachata", likesBack: true, instagram: "lena.tanzt" },
  { id: "lp-mo", vorname: "Mo", alter: 29, foto: null, hint: "Geclinkt um 00:12 · an der Bar", likesBack: false, instagram: null },
  { id: "lp-sofia", vorname: "Sofia", alter: 31, foto: null, hint: "Geclinkt um 00:58 · Salsa", likesBack: true, instagram: null },
  { id: "lp-jonas", vorname: "Jonas", alter: 24, foto: null, hint: "Geclinkt um 01:30 · letzter Song", likesBack: true, instagram: "jonas.dreht" },
];

export function SwipeDemo() {
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ matches: number; done: number }>({ matches: 0, done: 0 });

  const onSwipe = useCallback((card: DeckCard, richtung: "rechts" | "links") => {
    const d = DEMO.find((x) => x.id === card.id)!;
    const isMatch = richtung === "rechts" && d.likesBack;
    setResult((r) => ({ matches: r.matches + (isMatch ? 1 : 0), done: r.done + 1 }));
    if (isMatch) setMatch({ id: d.id, vorname: d.vorname, foto: null, instagram: d.instagram });
  }, []);

  return (
    <>
      <SwipeDeck
        key={round}
        compact
        keyboard={false}
        cards={DEMO}
        onSwipe={onSwipe}
        empty={
          <div style={{ textAlign: "center", padding: "60px 16px", display: "grid", gap: 16, justifyItems: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800 }}>
              {result.matches === 1 ? "1 Match" : `${result.matches} Matches`}
            </p>
            <p style={{ color: "var(--mute-on-dark)", maxWidth: 260 }}>
              Alle Clinks des Abends gesehen. Der Rest verfällt nach 72 Stunden.
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setRound((r) => r + 1);
                setResult({ matches: 0, done: 0 });
              }}
            >
              Nochmal
            </button>
          </div>
        }
      />
      {match && <MatchOverlay me={{ id: "lp-du", vorname: "Du", foto: null }} partner={match} onClose={() => setMatch(null)} />}
    </>
  );
}
