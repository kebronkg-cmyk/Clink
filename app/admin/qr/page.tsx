import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getStore } from "@/lib/store";
import { SITE_URL } from "@/lib/config";
import { isAdmin } from "@/lib/session";
import { PrintButton } from "@/components/PrintButton";
import s from "./qr.module.css";

export const metadata: Metadata = { title: "QR-Codes", robots: { index: false } };
export const dynamic = "force-dynamic";

// Druckbogen: ein QR-Code pro Band, führt direkt zum Check-in mit eingetragener Band-ID.
export default async function QrSheet() {
  if (!(await isAdmin())) redirect("/admin");
  const bands = await getStore().listBands();
  const codes = await Promise.all(
    bands.map(async (b) => {
      const url = `${SITE_URL}/checkin?band=${encodeURIComponent(b.id)}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#16121C", light: "#FFFFFF" } });
      return { id: b.id, svg };
    }),
  );
  return (
    <div className={s.page}>
      <div className={s.bar}>
        <p>
          {codes.length} QR-Codes · Ziel: <code>{SITE_URL}/checkin?band=…</code>
        </p>
        <PrintButton />
      </div>
      <div className={s.grid}>
        {codes.map((c) => (
          <div key={c.id} className={s.label}>
            <div className={s.qr} dangerouslySetInnerHTML={{ __html: c.svg }} />
            <p className={s.brand}>CLINK</p>
            <p className={s.id}>{c.id}</p>
            <p className={s.hint}>Scannen & einchecken</p>
          </div>
        ))}
      </div>
    </div>
  );
}
