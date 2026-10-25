"use client";

import { useRef, useState } from "react";
import styles from "./ClinkStage.module.css";

// Die Geste als Animation: zwei Bänder stoßen an, beide vibrieren.
// Antippen spielt sie nach, inklusive Vibration auf dem Handy (nur beim ersten Mal, wie am Band).
export function ClinkStage() {
  const [clinks, setClinks] = useState(0);
  const [run, setRun] = useState(0);
  const [once, setOnce] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const clink = () => {
    if (clinks === 0) navigator.vibrate?.([60, 40, 60]);
    setClinks((c) => c + 1);
    setRun((r) => r + 1);
    setOnce(true);
    // Danach nahtlos zurück in die Endlosschleife (Start- und Endpose sind gleich).
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOnce(false), 1650);
  };

  const message =
    clinks === 0
      ? "Tipp drauf und stoß an."
      : clinks === 1
        ? "Bzzz! Beide Bänder vibrieren. Begegnung gespeichert."
        : "Schon gespeichert. Pro Paar zählt ein Clink, vibriert wird nur beim ersten Mal.";

  return (
    <div className={styles.stage}>
      <button type="button" className={styles.hit} onClick={clink} aria-label="Anstoßen ausprobieren">
        <div className={styles.glow} aria-hidden="true" />
        <svg key={run} className={`${styles.svg} ${once ? styles.once : styles.loop}`} viewBox="0 0 640 560" aria-hidden="true">
          <g className={styles.left}>
            <g transform="rotate(-18 220 340)">
              <rect x="80" y="230" width="270" height="220" rx="110" fill="none" stroke="#F6F1EA" strokeWidth="26" />
              <rect className={styles.module} x="165" y="208" width="100" height="56" rx="14" fill="#F25CC6" />
            </g>
          </g>
          <g className={styles.right}>
            <g transform="rotate(18 420 340)">
              <rect x="290" y="230" width="270" height="220" rx="110" fill="none" stroke="#F6F1EA" strokeWidth="26" />
              <rect className={styles.module} x="375" y="208" width="100" height="56" rx="14" fill="#F25CC6" />
            </g>
          </g>
          <g className={styles.lines} stroke="#F25CC6" strokeWidth="14" strokeLinecap="round">
            <line x1="320" y1="160" x2="320" y2="90" />
            <line x1="262" y1="174" x2="226" y2="116" />
            <line x1="378" y1="174" x2="414" y2="116" />
          </g>
          <text className={styles.bzz} x="470" y="120" fill="#F7A6E0">
            bzzz
          </text>
        </svg>
      </button>
      <p className={styles.caption} aria-live="polite">
        <span className={styles.counter}>{clinks === 0 ? "✦" : clinks}</span>
        {message}
      </p>
    </div>
  );
}
