import { SiteFooter, SiteHeader } from "./SiteChrome";
import styles from "./LegalPage.module.css";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className={`wrap ${styles.page}`}>
        <h1>{title}</h1>
        <div className={styles.body}>{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
