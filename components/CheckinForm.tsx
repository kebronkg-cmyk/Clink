"use client";

/* eslint-disable @next/next/no-img-element */
import { startTransition, useActionState, useRef, useState } from "react";
import { submitCheckin, type FormState } from "@/app/actions";
import { MIN_AGE } from "@/lib/config";
import styles from "./CheckinForm.module.css";

type Prefill = { vorname: string; alter: number; instagram: string | null; freigabe: boolean; email: string | null; foto: string | null };

/** Verkleinert das Foto im Browser auf max. 800 px, damit der Upload auch im Club-WLAN schnell geht. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Foto"))), "image/jpeg", 0.85));
}

export function CheckinForm({ band, prefill }: { band: string; prefill: Prefill | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitCheckin, null);
  const [preview, setPreview] = useState<string | null>(prefill?.foto ?? null);
  const [shareIg, setShareIg] = useState(prefill?.freigabe ?? true);
  const photo = useRef<Blob | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      photo.current = await shrink(file);
      setPreview(URL.createObjectURL(photo.current));
    } catch {
      photo.current = null;
      setPhotoError("Dieses Foto konnten wir nicht lesen. Probier ein anderes.");
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("foto");
    if (photo.current) fd.set("foto", new File([photo.current], "foto.jpg", { type: "image/jpeg" }));
    startTransition(() => action(fd));
  };

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <label className="field">
        <span>Nummer deines Bands</span>
        <input
          className={`input ${styles.band}`}
          name="band"
          defaultValue={band}
          required
          inputMode="text"
          autoCapitalize="characters"
          placeholder="z. B. 778775"
        />
        <small>Steht auf dem Band. Mit dem QR-Code am Band ist sie schon eingetragen.</small>
      </label>

      <div className={styles.photoRow}>
        <label className={styles.photo}>
          {preview ? <img src={preview} alt="Dein Foto" /> : <span className={styles.photoPlus}>+</span>}
          <input type="file" name="foto" accept="image/jpeg,image/png,image/webp" capture="user" onChange={onPhoto} className="sr-only" />
        </label>
        <div>
          <p className={styles.photoTitle}>Dein Foto</p>
          <p className={styles.photoText}>Damit dich deine Clinks morgen wiedererkennen. Ein Selfie reicht.</p>
          {photoError && <p className={styles.photoError}>{photoError}</p>}
        </div>
      </div>

      <div className={styles.row}>
        <label className="field">
          <span>Vorname</span>
          <input className="input" name="vorname" required maxLength={40} autoComplete="given-name" defaultValue={prefill?.vorname} />
        </label>
        <label className="field">
          <span>Alter</span>
          <input
            className="input"
            name="alter"
            type="number"
            inputMode="numeric"
            min={MIN_AGE}
            max={99}
            required
            defaultValue={prefill?.alter}
          />
        </label>
      </div>

      <label className="field">
        <span>Instagram (optional)</span>
        <div className={styles.at}>
          <span>@</span>
          <input className="input" name="instagram" autoCapitalize="none" autoCorrect="off" maxLength={80} defaultValue={prefill?.instagram ?? ""} />
        </div>
      </label>
      <label className="check">
        <input type="checkbox" name="instagram_freigabe" checked={shareIg} onChange={(e) => setShareIg(e.target.checked)} />
        <span>Nach einem Match darf mein Match mein Instagram sehen. Vorher sieht es niemand.</span>
      </label>

      <label className="field">
        <span>E-Mail für deinen Link morgen (optional)</span>
        <input className="input" name="email" type="email" autoComplete="email" defaultValue={prefill?.email ?? ""} />
        <small>Ohne E-Mail zeigen wir dir gleich einen persönlichen Link zum Speichern.</small>
      </label>

      <fieldset className={styles.consents}>
        <legend className="sr-only">Einwilligungen</legend>
        <label className="check">
          <input type="checkbox" name="volljaehrig" required />
          <span>Ich bin mindestens {MIN_AGE} Jahre alt.</span>
        </label>
        <label className="check">
          <input type="checkbox" name="datenschutz" required />
          <span>
            Ich willige ein, dass mein Profil und meine Begegnungen dieses Abends gespeichert und den Personen gezeigt werden, mit denen ich
            geclinkt habe. Nach Ablauf der Swipe-Zeit werden Begegnungen und Swipes gelöscht. Details in der{" "}
            <a href="/datenschutz" target="_blank">
              Datenschutzerklärung
            </a>
            .
          </span>
        </label>
      </fieldset>

      {state?.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}

      <button className={`btn btn-pink ${styles.submit}`} disabled={pending}>
        {pending ? "Band wird verbunden …" : "Band verbinden"}
      </button>
    </form>
  );
}
