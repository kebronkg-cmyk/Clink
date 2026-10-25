"use client";

import { useActionState } from "react";
import { importCsv, login, type ImportState } from "@/app/admin/actions";

export function AdminLogin() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <label className="field">
        <span>Passwort</span>
        <input className="input" type="password" name="password" required autoFocus autoComplete="current-password" />
      </label>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn btn-pink" disabled={pending}>
        Anmelden
      </button>
    </form>
  );
}

export function ImportForm({ events, defaultEvent }: { events: Array<{ id: string; label: string }>; defaultEvent?: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importCsv, null);
  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <label className="field">
        <span>Event</span>
        <select className="input" name="event_id" defaultValue={defaultEvent} required>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>CSV-Datei vom Gateway</span>
        <input className="input" type="file" name="datei" accept=".csv,text/csv,text/plain" />
      </label>
      <label className="field">
        <span>… oder Zeilen einfügen</span>
        <textarea className="input" name="csv" placeholder={"band_a,band_b,timestamp\n778775,778776,2026-11-14T23:41:12Z"} style={{ fontFamily: "monospace", fontSize: 14 }} />
      </label>
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.result && (
        <div className="notice" role="status" style={{ display: "grid", gap: 6 }}>
          <p>
            <strong>{state.result.neu}</strong> neue Begegnungen gespeichert · {state.result.gelesen} Zeilen gelesen · {state.result.doppelt}{" "}
            doppelt (beide Bänder melden jede Begegnung)
          </p>
          {state.result.ohneCheckin > 0 && <p>{state.result.ohneCheckin} Zeilen mit Bändern ohne Check-in an diesem Abend.</p>}
          {state.result.fehler.length > 0 && (
            <details>
              <summary>{state.result.fehler.length} fehlerhafte Zeilen</summary>
              <ul>
                {state.result.fehler.slice(0, 50).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <div>
        <button className="btn btn-pink" disabled={pending}>
          {pending ? "Importiere …" : "Begegnungen importieren"}
        </button>
      </div>
    </form>
  );
}
