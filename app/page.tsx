import Link from "next/link";
import { ClinkStage } from "@/components/ClinkStage";
import { SwipeDemo } from "@/components/SwipeDemo";
import { LeadForm } from "@/components/LeadForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SWIPE_WINDOW_HOURS, MIN_AGE } from "@/lib/config";
import { sz } from "@/components/Sz";
import s from "./landing.module.css";

const MARQUEE = ["Handy bleibt in der Tasche", "Anstoßen", "Bzzz", "Weitertanzen", "Morgen swipen", "Match"];

const PROBLEMS = [
  ["Man verliert sich aus den Augen", "Man tanzt zusammen, der Song endet, der Moment ist vorbei. Kein Name, keine Nummer."],
  ["Ansprechen kostet Überwindung", "Viele trauen sich nicht, nach dem Kontakt zu fragen, schon gar nicht vor Freunden."],
  ["Apps sind nicht im Raum", "Dating-Apps funktionieren online. Im echten Moment auf der Tanzfläche holen sie niemanden ab."],
];

const STEPS: Array<{ n: string; title: string; text: string; icon: React.ReactNode }> = [
  {
    n: "01",
    title: "Einchecken",
    text: "Am Eingang gibt's dein Band. QR-Code scannen, Vorname und Foto, fertig. Kein App-Download.",
    icon: (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="8" width="20" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="36" y="8" width="20" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="8" y="36" width="20" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="15" y="15" width="6" height="6" fill="#F25CC6" />
        <rect x="43" y="15" width="6" height="6" fill="#F25CC6" />
        <rect x="15" y="43" width="6" height="6" fill="#F25CC6" />
        <path d="M38 38h6v6h-6zM50 38h6v6h-6zM44 44h6v6h-6zM38 50h6v6h-6zM50 50h6v6h-6z" fill="currentColor" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Anstoßen",
    text: "Handgelenke aneinander, wie mit Gläsern. Beide Bänder vibrieren, die Begegnung ist gespeichert. Paartanz verbindet auch.",
    icon: (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <g transform="rotate(-18 22 40)">
          <rect x="6" y="30" width="30" height="22" rx="11" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="15" y="26" width="12" height="7" rx="2" fill="#F25CC6" />
        </g>
        <g transform="rotate(18 42 40)">
          <rect x="28" y="30" width="30" height="22" rx="11" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="37" y="26" width="12" height="7" rx="2" fill="#F25CC6" />
        </g>
        <path d="M32 18v-8M25 20l-4-6M39 20l4-6" stroke="#F25CC6" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Band abgeben",
    text: "Beim Rausgehen kommt das Band in den Ladeschrank. Dort werden die Begegnungen ausgelesen, das Band lädt für den nächsten Abend.",
    icon: (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="10" y="10" width="44" height="46" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M10 26h44M10 41h44" stroke="currentColor" strokeWidth="4" />
        <circle cx="22" cy="18" r="3" fill="#F25CC6" />
        <circle cx="32" cy="18" r="3" fill="#F25CC6" />
        <circle cx="42" cy="18" r="3" fill="#F25CC6" />
        <circle cx="22" cy="33.5" r="3" fill="#F25CC6" />
        <circle cx="32" cy="33.5" r="3" fill="currentColor" />
        <circle cx="22" cy="48.5" r="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    n: "04",
    title: "Morgen swipen",
    text: "Am nächsten Tag siehst du, mit wem du geclinkt hast. Rechts oder links. Ein Match gibt es nur, wenn beide wollen.",
    icon: (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="16" y="6" width="32" height="52" rx="7" fill="none" stroke="currentColor" strokeWidth="4" />
        <path
          d="M32 42s-8-4.8-9.8-10c-1.3-3.7 1.1-7 4.6-7 2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.5 0 5.9 3.3 4.6 7C40 37.2 32 42 32 42z"
          fill="#F25CC6"
        />
      </svg>
    ),
  },
];

const PROMISES = [
  ["Nur, wenn beide wollen", "Ein Match entsteht ausschließlich, wenn ihr euch gegenseitig nach rechts swipet. Wer links swipet, bleibt unsichtbar."],
  ["Keine Nummern im Club", "Kein Handy auf der Tanzfläche, kein Nummerntausch. Nach dem Match seht ihr nur das Instagram, das ihr freigebt."],
  ["Das Band kennt keine Namen", "Auf dem Band liegen nur Nummern. Erst der Check-in verbindet es für genau einen Abend mit dir."],
  ["Daten mit Ablaufdatum", `Nach ${SWIPE_WINDOW_HOURS} Stunden verfallen Begegnungen und Swipes und werden gelöscht. Dein Profil löschst du jederzeit selbst.`],
];

const FAQ = [
  [
    "Was, wenn ich aus Versehen mit jemandem clinke?",
    "Kein Problem. Du swipest die Person einfach nach links. Sie erfährt davon nichts, ein Match gibt es nur bei gegenseitigem Interesse.",
  ],
  [
    "Verbindet auch Tanzen?",
    "Ja. Beim Paartanz verbinden sich die Bänder auch automatisch, das ist gewollt. Pro Paar wird trotzdem nur einmal gespeichert und nur beim ersten Mal vibriert.",
  ],
  ["Brauche ich eine App?", "Nein. CLINK läuft im Browser deines Handys. Wer mag, legt es sich auf den Homescreen."],
  [
    "Wie lange kann ich swipen?",
    `${SWIPE_WINDOW_HOURS} Stunden nach dem Abend. Danach verfällt alles, also nicht zu lange warten.`,
  ],
  ["Was passiert nach einem Match?", "Ihr seht beide das Instagram der anderen Person, sofern es beim Check-in freigegeben wurde. Telefonnummern sieht niemand."],
  ["Ab wie viel Jahren?", `CLINK gibt es ab ${MIN_AGE}. Das Alter bestätigst du beim Check-in.`],
  ["Was passiert mit meinem Band?", "Du gibst es beim Rausgehen ab. Es wird ausgelesen, geladen und am nächsten Abend neu vergeben."],
];

export default async function Landing({ searchParams }: { searchParams: Promise<{ geloescht?: string }> }) {
  const { geloescht } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main>
        {geloescht && (
          <div className="wrap" style={{ paddingTop: 20 }}>
            <p className="notice" role="status">
              Dein Profil und deine Daten wurden gelöscht.
            </p>
          </div>
        )}

        {/* Hero */}
        <section className={s.hero}>
          <div className={`wrap ${s.heroGrid}`}>
            <div className={s.heroText}>
              <p className="eyebrow">Für Tanzbars, Socials & Clubnächte</p>
              <h1 className={s.heroTitle}>
                {sz("Anstoßen.")}
                <br />
                Verbinden.
                <br />
                <span>Wiedersehen.</span>
              </h1>
              <p className={s.lead}>
                CLINK ist das Armband, mit dem Begegnungen auf der Tanzfläche nicht verloren gehen. Handgelenke aneinander, beide Bänder
                vibrieren, und morgen siehst du, mit wem du angestoßen hast.
              </p>
              <div className={s.ctas}>
                <a href="#ablauf" className="btn btn-pink">
                  So funktioniert&apos;s
                </a>
                <a href="#clubs" className="btn btn-ghost">
                  CLINK für deinen Club
                </a>
              </div>
            </div>
            <div className={s.heroStage}>
              <ClinkStage />
            </div>
          </div>
        </section>

        {/* Laufband */}
        <div className={s.marquee} aria-hidden="true">
          <div className={s.marqueeTrack}>
            {[0, 1].map((k) => (
              <span key={k}>
                {MARQUEE.map((m) => (
                  <span key={m}>
                    {m} <i>✦</i>{" "}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* Problem */}
        <section className={`light ${s.light}`}>
          <div className="wrap">
            <p className="eyebrow">Kennst du das?</p>
            <h2 className={s.h2}>Die besten Begegnungen des Abends enden ohne Namen.</h2>
            <div className={s.cards3}>
              {PROBLEMS.map(([t, d]) => (
                <article key={t} className={s.sandCard}>
                  <h3>{sz(t)}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Ablauf */}
        <section id="ablauf" className={s.dark}>
          <div className="wrap">
            <p className="eyebrow">So geht&apos;s</p>
            <h2 className={s.h2}>
              Vier Schritte. <span className={s.pink}>Eine Geste.</span>
            </h2>
            <ol className={s.steps}>
              {STEPS.map((st) => (
                <li key={st.n} className={s.step}>
                  <div className={s.stepTop}>
                    <span className={s.stepIcon}>{st.icon}</span>
                    <span className={s.stepNum}>{st.n}</span>
                  </div>
                  <h3>{sz(st.title)}</h3>
                  <p>{st.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Geste */}
        <section className={s.gesture}>
          <div className={`wrap ${s.gestureInner}`}>
            <p className={s.gestureWord}>Clink.</p>
            <div>
              <p className={s.gestureLine}>{sz("Wie Anstoßen mit Gläsern. Nur mit dem Handgelenk.")}</p>
              <p className={s.gestureSub}>Die Geste ist die Marke. Am Eingang zeigen wir dir, wie&apos;s geht.</p>
            </div>
          </div>
        </section>

        {/* Swipe-Demo */}
        <section className={s.dark}>
          <div className={`wrap ${s.demoGrid}`}>
            <div>
              <p className="eyebrow">Am nächsten Tag</p>
              <h2 className={s.h2}>In Ruhe entscheiden. Ohne Druck.</h2>
              <p className={s.body}>
                Rechts heißt: gern wiedersehen. Links heißt: schöner Tanz, mehr nicht. Ein Match gibt es nur, wenn ihr beide nach rechts
                swipet. Ungewollte Clinks kosten also nichts.
              </p>
              <div className={s.chips}>
                <span>⏱ {SWIPE_WINDOW_HOURS} Stunden Zeit</span>
                <span>♥ Nur gegenseitig</span>
                <span>✕ Links bleibt geheim</span>
              </div>
              <p className={s.tryHint}>Probier&apos;s aus: Wisch die Karten oder nutze die Buttons.</p>
            </div>
            <div className={s.phone}>
              <div className={s.phoneTop}>
                <span>Deine Clinks · gestern</span>
              </div>
              <SwipeDemo />
            </div>
          </div>
        </section>

        {/* Versprechen */}
        <section className={`light ${s.light}`}>
          <div className="wrap">
            <p className="eyebrow">Echte Begegnung zuerst</p>
            <h2 className={s.h2}>Digital erst danach.</h2>
            <div className={s.cards4}>
              {PROMISES.map(([t, d]) => (
                <article key={t} className={s.sandCard}>
                  <h3>{sz(t)}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className={s.dark}>
          <div className={`wrap ${s.faqGrid}`}>
            <div>
              <p className="eyebrow">Fragen</p>
              <h2 className={s.h2}>Gut zu wissen.</h2>
            </div>
            <div className={s.faq}>
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Für Clubs */}
        <section id="clubs" className={s.clubs}>
          <div className={`wrap ${s.clubsGrid}`}>
            <div>
              <p className="eyebrow">Für Locations & Veranstalter</p>
              <h2 className={s.h2}>CLINK für deinen Club.</h2>
              <p className={s.body}>
                Ein Event-Format, das besondere Nächte schafft. Wir bringen Bänder und Ladeschrank mit, deine Gäste brauchen nur ihr
                Handgelenk.
              </p>
              <ul className={s.ticks}>
                <li>Kein App-Download: Jeder Gast mit Band macht mit.</li>
                <li>Außer dem Ladeschrank wird nichts installiert.</li>
                <li>Ideal für Single-, Uni-, Themen- und Social-Dance-Abende.</li>
              </ul>
            </div>
            <div className={s.formCard}>
              <LeadForm />
            </div>
          </div>
        </section>

        {/* Schluss */}
        <section className={s.outro}>
          <div className="wrap">
            <p className={s.outroTitle}>Bis gleich auf der Tanzfläche.</p>
            <div className={s.ctas} style={{ justifyContent: "center" }}>
              <Link href="/checkin" className="btn btn-pink">
                Band einchecken
              </Link>
              <Link href="/app" className="btn btn-ghost">
                Meine Clinks ansehen
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
