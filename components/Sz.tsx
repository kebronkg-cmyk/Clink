/** Ersetzt ß in Syne-Überschriften durch das ß aus DM Sans (Syne-ß liest sich wie „fz“). */
export function sz(text: string): React.ReactNode {
  if (!text.includes("ß")) return text;
  return text.split("ß").flatMap((part, i) => (i === 0 ? [part] : [<span key={i} className="sz">ß</span>, part]));
}
