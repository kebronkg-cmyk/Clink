"use client";

import { useActionState } from "react";
import { submitLead, type FormState } from "@/app/actions";

export function LeadForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitLead, null);

  if (state?.ok) {
    return (
      <div className="notice" role="status" style={{ padding: 28 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--pink)" }}>Clink!</p>
        <p style={{ marginTop: 8 }}>Danke für deine Anfrage. Wir melden uns in den nächsten Tagen bei dir.</p>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label className="field">
          <span>Dein Name</span>
          <input className="input" name="name" required autoComplete="name" />
        </label>
        <label className="field">
          <span>E-Mail</span>
          <input className="input" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="field">
          <span>Location / Veranstaltung</span>
          <input className="input" name="location" required placeholder="z. B. Salsa-Bar am Eck" />
        </label>
        <label className="field">
          <span>Stadt</span>
          <input className="input" name="stadt" required autoComplete="address-level2" />
        </label>
      </div>
      <label className="field">
        <span>Was schwebt dir vor?</span>
        <textarea className="input" name="nachricht" placeholder="Art des Abends, Gästezahl, Wunschtermin …" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ display: "none" }} />
      <label className="check">
        <input type="checkbox" name="einwilligung" required />
        <span>
          Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden. Mehr in der{" "}
          <a href="/datenschutz">Datenschutzerklärung</a>.
        </span>
      </label>
      {state?.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className="btn btn-pink" disabled={pending}>
          {pending ? "Wird gesendet …" : "Anfrage senden"}
        </button>
      </div>
    </form>
  );
}
