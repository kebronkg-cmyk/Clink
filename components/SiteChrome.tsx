import Link from "next/link";
import { Logo } from "./Logo";
import styles from "./SiteChrome.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.headerInner}`}>
        <Link href="/" className={styles.brand} aria-label="CLINK Startseite">
          <Logo size={30} />
        </Link>
        <nav className={styles.nav} aria-label="Hauptnavigation">
          <a href="/#ablauf">So geht&apos;s</a>
          <a href="/#faq">FAQ</a>
          <a href="/#clubs">Für Clubs</a>
        </nav>
        <Link href="/app" className={`btn btn-pink ${styles.cta}`}>
          Meine Clinks
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <Logo size={36} />
          <p>Anstoßen. Verbinden. Wiedersehen.</p>
        </div>
        <nav className={styles.footerNav} aria-label="Fußzeile">
          <Link href="/checkin">Check-in</Link>
          <Link href="/app">Meine Clinks</Link>
          <a href="/#clubs">Für Clubs</a>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
        </nav>
        <p className={styles.by}>
          by <strong>WeDance</strong>
        </p>
      </div>
    </footer>
  );
}
