"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Mein CLINK-Link", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* abgebrochen */
    }
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} style={{ fontSize: 13 }} aria-label="Persönlicher Link" />
      <button type="button" className="btn btn-pink" onClick={copy} style={{ flex: "none" }}>
        {copied ? "Kopiert" : "Sichern"}
      </button>
    </div>
  );
}
