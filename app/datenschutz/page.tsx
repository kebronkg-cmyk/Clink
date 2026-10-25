import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { MIN_AGE, SWIPE_WINDOW_HOURS } from "@/lib/config";

export const metadata: Metadata = { title: "Datenschutz" };

// Entwurf auf Basis der Spezifikation (Abschnitt 5). Vor dem Pilot rechtlich prüfen lassen.
export default function Datenschutz() {
  return (
    <LegalPage title="Datenschutz">
      <p>
        Kurz gesagt: Wir speichern nur, was CLINK zum Funktionieren braucht, zeigen Kontaktdaten erst nach einem gegenseitigen Match und löschen
        Begegnungen nach Ablauf der Swipe-Zeit.
      </p>

      <h2>Verantwortlich</h2>
      <p>
        WeDance, Alex Razbakov, <mark>[Anschrift]</mark>, <mark>[E-Mail]</mark>. Siehe <a href="/impressum">Impressum</a>.
      </p>

      <h2>Was wir speichern</h2>
      <ul>
        <li>
          <strong>Profil beim Check-in:</strong> Vorname, Alter, Foto, optional Instagram-Name und E-Mail-Adresse.
        </li>
        <li>
          <strong>Zuordnung Band ↔ Gast:</strong> für genau einen Abend. Das Band selbst kennt nur Nummern, keine Namen.
        </li>
        <li>
          <strong>Begegnungen:</strong> die Band-Nummern zweier Bänder, die angestoßen haben oder zusammen getanzt haben, mit Zeitpunkt.
        </li>
        <li>
          <strong>Swipes und Matches:</strong> wer wen nach rechts oder links geswipet hat, und gegenseitige Matches.
        </li>
        <li>
          <strong>Kontaktanfragen von Locations:</strong> Name, E-Mail, Location, Stadt und Nachricht.
        </li>
      </ul>

      <h2>Wer was sieht</h2>
      <ul>
        <li>Personen, mit denen du geclinkt hast, sehen am nächsten Tag deinen Vornamen, dein Alter und dein Foto.</li>
        <li>Ob du links oder rechts geswipet hast, sieht niemand.</li>
        <li>Dein Instagram-Name wird nur nach einem gegenseitigen Match gezeigt und nur, wenn du ihn freigegeben hast.</li>
        <li>Telefonnummern werden nicht erfasst. Deine E-Mail-Adresse sieht kein anderer Gast.</li>
      </ul>

      <h2>Rechtsgrundlage</h2>
      <p>
        Deine Einwilligung beim Check-in (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit widerrufen, indem du dein Profil im Gast-Bereich
        löschst. Für Anfragen von Locations: Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertrags).
      </p>

      <h2>Wie lange</h2>
      <ul>
        <li>Begegnungen und Swipes: bis zum Ende der Swipe-Zeit ({SWIPE_WINDOW_HOURS} Stunden nach dem Abend), dann werden sie gelöscht.</li>
        <li>Matches und Profil: bis du dein Profil löschst. <mark>[Automatische Löschung inaktiver Profile nach … Monaten festlegen]</mark></li>
        <li>Kontaktanfragen: bis die Anfrage erledigt ist, höchstens <mark>[…]</mark>.</li>
      </ul>

      <h2>Wo</h2>
      <p>
        Datenbank und Fotos liegen bei Supabase mit Serverstandort in der EU, die Website wird über <mark>[Vercel oder Netlify]</mark>{" "}
        ausgeliefert. Mit beiden Anbietern bestehen Verträge zur Auftragsverarbeitung. <mark>[Prüfen und ergänzen]</mark>
      </p>

      <h2>Cookies</h2>
      <p>
        Wir setzen nur ein technisch notwendiges Cookie, das dich nach dem Check-in auf deinem Gerät angemeldet hält. Kein Tracking, keine Werbung.
      </p>

      <h2>Ab {MIN_AGE}</h2>
      <p>CLINK ist nur für Personen ab {MIN_AGE} Jahren. Das Alter wird beim Check-in bestätigt.</p>

      <h2>Deine Rechte</h2>
      <p>
        Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Schreib uns an <mark>[E-Mail]</mark>. Du kannst
        dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, in Bayern beim Bayerischen Landesamt für Datenschutzaufsicht.
      </p>
    </LegalPage>
  );
}
