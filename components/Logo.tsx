// Bildmarke aus dem Pitch Deck: zwei Armbänder, die aneinanderstoßen.
export function ClinkMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="60 110 520 420" aria-hidden="true">
      <g transform="rotate(-18 220 380)">
        <rect x="80" y="270" width="270" height="220" rx="110" fill="none" stroke="currentColor" strokeWidth="34" />
        <rect x="165" y="248" width="100" height="56" rx="14" fill="#F25CC6" />
      </g>
      <g transform="rotate(18 420 380)">
        <rect x="290" y="270" width="270" height="220" rx="110" fill="none" stroke="currentColor" strokeWidth="34" />
        <rect x="375" y="248" width="100" height="56" rx="14" fill="#F25CC6" />
      </g>
      <g stroke="#F25CC6" strokeWidth="20" strokeLinecap="round">
        <line x1="320" y1="200" x2="320" y2="130" />
        <line x1="262" y1="214" x2="226" y2="156" />
        <line x1="378" y1="214" x2="414" y2="156" />
      </g>
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <ClinkMark size={size} />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: size * 0.8,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        CLINK
      </span>
    </span>
  );
}
