/* eslint-disable @next/next/no-img-element */

// Profilbild oder, ohne Foto, ein Verlauf in Markenfarben mit Initiale.
const GRADIENTS = [
  ["#F25CC6", "#B8288F"],
  ["#F7A6E0", "#F25CC6"],
  ["#B8288F", "#211A2B"],
  ["#F25CC6", "#2B2236"],
  ["#F7A6E0", "#B8288F"],
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  foto,
  id,
  size,
  radius = 999,
  fill = false,
}: {
  name: string;
  foto: string | null;
  id: string;
  size?: number;
  radius?: number;
  fill?: boolean;
}) {
  const style: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: radius }
    : { width: size, height: size, borderRadius: radius, flex: "none" };
  if (foto) return <img src={foto} alt={name} style={{ ...style, objectFit: "cover" }} />;
  const [a, b] = GRADIENTS[hash(id) % GRADIENTS.length];
  return (
    <div
      role="img"
      aria-label={name}
      style={{
        ...style,
        background: `radial-gradient(circle at 30% 25%, ${a}, ${b})`,
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        color: "#16121C",
        fontSize: fill ? "clamp(80px, 30vw, 160px)" : (size ?? 40) * 0.42,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
