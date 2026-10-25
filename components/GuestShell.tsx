import Link from "next/link";
import { Logo } from "./Logo";
import styles from "./GuestShell.module.css";

// Schmaler, mobiler Rahmen für Check-in und Gast-Bereich.
export function GuestShell({
  children,
  tab,
  demo = false,
}: {
  children: React.ReactNode;
  tab?: "clinks" | "matches";
  demo?: boolean;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href="/" aria-label="CLINK Startseite" className={styles.logo}>
          <Logo size={26} />
        </Link>
        {tab && (
          <nav className={styles.tabs} aria-label="Gast-Bereich">
            <Link href="/app" aria-current={tab === "clinks" ? "page" : undefined}>
              Clinks
            </Link>
            <Link href="/app/matches" aria-current={tab === "matches" ? "page" : undefined}>
              Matches
            </Link>
          </nav>
        )}
      </header>
      {demo && <p className={styles.demo}>Demo-Modus · Beispieldaten, nichts wird dauerhaft gespeichert</p>}
      <main className={styles.main}>{children}</main>
      <footer className={styles.foot}>
        <Link href="/impressum">Impressum</Link>
        <Link href="/datenschutz">Datenschutz</Link>
        <span>by WeDance</span>
      </footer>
    </div>
  );
}
