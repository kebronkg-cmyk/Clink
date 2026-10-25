import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Impressum" };

// Platzhalter in <mark> müssen vor dem Livegang mit echten Angaben ersetzt werden.
export default function Impressum() {
  return (
    <LegalPage title="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        <strong>WeDance</strong>
        <br />
        Alex Razbakov
        <br />
        <mark>[Straße und Hausnummer]</mark>
        <br />
        <mark>[PLZ] München</mark>
      </p>
      <h2>Kontakt</h2>
      <p>
        E-Mail: <mark>[kontakt@…]</mark>
        <br />
        Telefon: <mark>[optional]</mark>
      </p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        Alex Razbakov, Anschrift wie oben. <mark>[Nach Gründung der UG: Firma, Registergericht, HRB-Nummer, Geschäftsführung, ggf. USt-IdNr.]</mark>
      </p>
      <h2>Projekt</h2>
      <p>CLINK ist ein Projekt in Partnerschaft mit WeDance.</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </LegalPage>
  );
}
