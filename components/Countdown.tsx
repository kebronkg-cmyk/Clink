"use client";

import { useEffect, useState } from "react";

function format(ms: number) {
  if (ms <= 0) return "abgelaufen";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  if (h >= 24) return `noch ${Math.floor(h / 24)} T ${h % 24} Std`;
  if (h >= 1) return `noch ${h} Std ${m} Min`;
  return `noch ${m} Min`;
}

/** Restzeit bis zum Verfall der Swipe-Frist, minütlich aktualisiert. */
export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span>…</span>;
  const left = new Date(until).getTime() - now;
  return <span style={{ color: left < 6 * 3600_000 ? "var(--pink)" : undefined }}>{format(left)}</span>;
}
