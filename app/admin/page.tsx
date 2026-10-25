import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AdminLogin, ImportForm } from "@/components/AdminForms";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getStore } from "@/lib/store";
import { eventStats, isOpen } from "@/lib/service";
import { isAdmin } from "@/lib/session";
import { activateEvent, addBands, createEvent, extendEvent, logout, releaseCheckin, runPurge, saveSettings } from "./actions";
import s from "./admin.module.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = [
  ["events", "Events"],
  ["baender", "Bänder"],
  ["import", "Import"],
  ["firmware", "Firmware"],
  ["statistik", "Statistik"],
  ["anfragen", "Anfragen"],
] as const;
type Tab = (typeof TABS)[number][0];

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }) : "–";
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const store = getStore();
  if (!(await isAdmin())) {
    return (
      <div className={s.loginWrap}>
        <div className={s.loginCard}>
          <Logo size={34} />
          <h1 className={s.loginTitle}>Admin</h1>
          {store.mode === "demo" && <p className={s.muted}>Demo-Modus: Passwort ist „clink“, solange ADMIN_PASSWORD nicht gesetzt ist.</p>}
          <AdminLogin />
        </div>
      </div>
    );
  }

  const wanted = (await searchParams).tab;
  const tab: Tab = TABS.find(([k]) => k === wanted)?.[0] ?? "events";
  const events = await store.listEvents();
  const active = events.find((e) => e.is_active) ?? null;

  return (
    <div className={s.shell}>
      <header className={s.top}>
        <Link href="/" className={s.brand}>
          <Logo size={26} />
        </Link>
        <span className={s.badge}>Admin{store.mode === "demo" ? " · Demo" : ""}</span>
        <form action={logout} style={{ marginLeft: "auto" }}>
          <button className="btn btn-ghost" style={{ minHeight: 40, fontSize: 14 }}>
            Abmelden
          </button>
        </form>
      </header>
      <nav className={s.tabs}>
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin?tab=${k}`} aria-current={k === tab ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <main className={s.main}>
        {tab === "events" && <EventsTab />}
        {tab === "baender" && <BandsTab />}
        {tab === "import" && (
          <section className={s.card}>
            <h2>Begegnungen importieren</h2>
            <p className={s.muted}>
              CSV aus dem Ladeschrank im Format <code>band_a,band_b,timestamp</code>. Jedes Paar wird pro Abend nur einmal gespeichert. Die
              Band-IDs werden über den Check-in den Gästen dieses Abends zugeordnet.
            </p>
            {events.length ? (
              <ImportForm
                events={events.map((e) => ({ id: e.id, label: `${e.name} · ${e.datum}` }))}
                defaultEvent={(events.find((e) => !e.is_active && isOpen(e)) ?? active ?? events[0]).id}
              />
            ) : (
              <p>Lege zuerst ein Event an.</p>
            )}
            <p className={s.muted} style={{ marginTop: 20 }}>
              Automatisch per Gateway: <code>POST /api/gateway/encounters</code> mit <code>Authorization: Bearer GATEWAY_TOKEN</code> und
              der CSV als Body. Siehe README.
            </p>
          </section>
        )}
        {tab === "firmware" && <FirmwareTab />}
        {tab === "statistik" && <StatsTab />}
        {tab === "anfragen" && <LeadsTab />}
      </main>
    </div>
  );

  async function EventsTab() {
    const checkins = active ? await store.listCheckins({ event_id: active.id }) : [];
    const guests = new Map((await store.getGuests(checkins.map((c) => c.guest_id))).map((g) => [g.id, g]));
    return (
      <>
        <section className={s.card}>
          <h2>Neues Event</h2>
          <form action={createEvent} className={s.formGrid}>
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" required placeholder="z. B. Pilotabend" />
            </label>
            <label className="field">
              <span>Datum</span>
              <input className="input" type="date" name="datum" required />
            </label>
            <label className="field">
              <span>Location</span>
              <input className="input" name="location" required />
            </label>
            <label className="check" style={{ alignSelf: "center" }}>
              <input type="checkbox" name="aktiv" />
              <span>Check-in sofort öffnen</span>
            </label>
            <div>
              <button className="btn btn-pink">Event anlegen</button>
            </div>
          </form>
        </section>

        <section className={s.card}>
          <h2>Events</h2>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Datum</th>
                  <th>Status</th>
                  <th>Swipen bis</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.name}</strong>
                      <br />
                      <span className={s.muted}>{e.location}</span>
                    </td>
                    <td>{e.datum}</td>
                    <td>
                      {e.is_active ? (
                        <span className={s.pill}>Check-in offen</span>
                      ) : isOpen(e) ? (
                        <span className={s.pillSoft}>Swipen läuft</span>
                      ) : (
                        <span className={s.muted}>abgelaufen</span>
                      )}
                    </td>
                    <td>{fmt(e.swipe_until)}</td>
                    <td className={s.actions}>
                      {e.is_active ? (
                        <form action={activateEvent.bind(null, null)}>
                          <button className="btn btn-ghost">Check-in schließen</button>
                        </form>
                      ) : (
                        <form action={activateEvent.bind(null, e.id)}>
                          <button className="btn btn-ghost">Check-in öffnen</button>
                        </form>
                      )}
                      <form action={extendEvent.bind(null, e.id, 24)}>
                        <button className="btn btn-ghost">+24 h</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={runPurge} style={{ marginTop: 16 }}>
            <button className="btn btn-ghost">Abgelaufene Daten jetzt löschen</button>
          </form>
        </section>

        {active && (
          <section className={s.card}>
            <h2>Check-ins heute · {checkins.length}</h2>
            {checkins.length === 0 ? (
              <p className={s.muted}>Noch niemand eingecheckt.</p>
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Band</th>
                      <th>Gast</th>
                      <th>Seit</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {checkins.map((c) => (
                      <tr key={c.band_id}>
                        <td>
                          <code>{c.band_id}</code>
                        </td>
                        <td>
                          {guests.get(c.guest_id)?.vorname ?? "–"}, {guests.get(c.guest_id)?.alter}
                        </td>
                        <td>{fmt(c.created_at)}</td>
                        <td className={s.actions}>
                          <form action={releaseCheckin.bind(null, active.id, c.band_id)}>
                            <ConfirmButton message={`Band ${c.band_id} für heute freigeben?`}>Band freigeben</ConfirmButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </>
    );
  }

  async function BandsTab() {
    const bands = await store.listBands();
    const checkins = active ? await store.listCheckins({ event_id: active.id }) : [];
    const used = new Set(checkins.map((c) => c.band_id));
    return (
      <>
        <section className={s.card}>
          <div className={s.cardHead}>
            <h2>Bänder · {bands.length}</h2>
            <Link href="/admin/qr" className="btn btn-pink" target="_blank">
              QR-Codes drucken
            </Link>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Geräte-ID</th>
                  <th>MAC</th>
                  <th>Akku</th>
                  <th>Letzter Kontakt</th>
                  <th>Heute</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <code>{b.id}</code>
                    </td>
                    <td>
                      <code className={s.muted}>{b.mac ?? "–"}</code>
                    </td>
                    <td>
                      {b.akku === null ? (
                        "–"
                      ) : (
                        <span className={s.battery} data-low={b.akku < 30 ? "" : undefined}>
                          <span style={{ width: `${b.akku}%` }} />
                          <b style={{ position: "relative" }}>{b.akku} %</b>
                        </span>
                      )}
                    </td>
                    <td>{fmt(b.last_seen)}</td>
                    <td>{used.has(b.id) ? <span className={s.pill}>vergeben</span> : <span className={s.muted}>frei</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className={s.card}>
          <h2>Bänder hinzufügen</h2>
          <p className={s.muted}>
            Eine Zeile pro Band: Geräte-ID vom Aufkleber, optional die MAC-Adresse. Akku und letzter Kontakt kommen vom Gateway.
          </p>
          <form action={addBands} style={{ display: "grid", gap: 14 }}>
            <textarea className="input" name="bands" required placeholder={"778775,BC57292696C9\n778776"} style={{ fontFamily: "monospace", fontSize: 14 }} />
            <div>
              <button className="btn btn-pink">Speichern</button>
            </div>
          </form>
        </section>
      </>
    );
  }

  async function FirmwareTab() {
    const st = await store.getSettings();
    return (
      <section className={s.card}>
        <h2>Firmware-Einstellungen</h2>
        <p className={s.muted}>Die Bänder übernehmen diese Werte beim nächsten Laden im Ladeschrank. Zuletzt geändert: {fmt(st.updated_at)}</p>
        <form action={saveSettings} className={s.formGrid}>
          <label className="field">
            <span>Stoß-Empfindlichkeit (Schwelle in g)</span>
            <input className="input" type="number" name="schwelle_stoss" step="0.1" min="0.1" max="16" defaultValue={st.schwelle_stoss} required />
            <small>Höher = fester anstoßen nötig.</small>
          </label>
          <label className="field">
            <span>Abstand über Signalstärke (RSSI in dBm)</span>
            <input className="input" type="number" name="schwelle_rssi" step="1" min="-100" max="0" defaultValue={st.schwelle_rssi} required />
            <small>Näher an 0 = Bänder müssen dichter beieinander sein.</small>
          </label>
          <label className="field">
            <span>Zeitfenster „gleichzeitig“ (ms)</span>
            <input className="input" type="number" name="zeitfenster_ms" step="10" min="10" max="2000" defaultValue={st.zeitfenster_ms} required />
            <small>Beide Bänder müssen den Stoß innerhalb dieses Fensters spüren.</small>
          </label>
          <div style={{ alignSelf: "end" }}>
            <button className="btn btn-pink">Speichern</button>
          </div>
        </form>
        <p className={s.muted} style={{ marginTop: 20 }}>
          Das Gateway liest die Werte unter <code>GET /api/gateway/settings</code>. Live-Einstellen per Web Bluetooth (nur Chrome auf Android)
          folgt nach dem Pilot.
        </p>
      </section>
    );
  }

  async function StatsTab() {
    const stats = await eventStats();
    return (
      <section className={s.card}>
        <h2>Statistik</h2>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Event</th>
                <th>Gäste</th>
                <th>Begegnungen</th>
                <th>Swipes</th>
                <th>Swipe-Rate</th>
                <th>davon rechts</th>
                <th>Matches</th>
                <th>Match-Rate</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((x) => (
                <tr key={x.event.id}>
                  <td>
                    <strong>{x.event.name}</strong>
                    <br />
                    <span className={s.muted}>{x.event.datum}</span>
                  </td>
                  <td>{x.gaeste}</td>
                  <td>{x.begegnungen}</td>
                  <td>{x.swipes}</td>
                  <td>{pct(x.swipeRate)}</td>
                  <td>{pct(x.rechtsRate)}</td>
                  <td>{x.matches}</td>
                  <td>{pct(x.matchRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.muted} style={{ marginTop: 16 }}>
          Swipe-Rate: Anteil der möglichen Swipes (2 pro Begegnung), die gemacht wurden. Match-Rate: Matches pro Begegnung. Nach Ablauf der Frist
          werden Begegnungen und Swipes gelöscht, dann zählen nur noch Gäste und Matches.
        </p>
      </section>
    );
  }

  async function LeadsTab() {
    const leads = await store.listLeads();
    return (
      <section className={s.card}>
        <h2>Anfragen von Locations · {leads.length}</h2>
        {leads.length === 0 ? (
          <p className={s.muted}>Noch keine Anfragen über „CLINK für deinen Club“.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {leads.map((l) => (
              <article key={l.id} className={s.lead}>
                <p>
                  <strong>{l.location}</strong>, {l.stadt} · {fmt(l.erstellt)}
                </p>
                <p>
                  {l.name} · <a href={`mailto:${l.email}`}>{l.email}</a>
                </p>
                {l.nachricht && <p className={s.muted}>{l.nachricht}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }
}
