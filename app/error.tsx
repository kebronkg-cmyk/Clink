"use client";

import Link from "next/link";

// Freundliche Fehlerseite statt „Application error“.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ display: "grid", gap: 16, maxWidth: 420, justifyItems: "center" }}>
        <p className="eyebrow">Hoppla</p>
        <h1 style={{ fontSize: 40 }}>Da ist was schiefgelaufen.</h1>
        <p style={{ color: "var(--mute-on-dark)" }}>Versuch es gleich nochmal. Wenn es wieder passiert, sag dem Team Bescheid.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="btn btn-pink" onClick={reset}>
            Nochmal versuchen
          </button>
          <Link href="/" className="btn btn-ghost">
            Zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}
