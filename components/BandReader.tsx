"use client";

import { useEffect, useRef, useState } from "react";
import {
  CMD,
  KIND,
  UUID_CONTROL,
  UUID_INFO,
  UUID_RECORDS,
  UUID_SERVICE,
  encodeParams,
  fromHex,
  parseInfo,
  parseRecords,
  toHex,
  u16Cmd,
  type BandInfo,
  type BandRecord,
} from "@/lib/band-protocol";
import { bandAuth, bandImport, bandParams, bandProvision, readoutEvents } from "@/app/admin/band-actions";
import styles from "./BandReader.module.css";

// Auslesen am Ausgang: Band in die Nähe halten, verbinden, Begegnungen
// übertragen, Band leeren. Web Bluetooth gibt es in Chrome/Edge auf
// Laptop und Android, nicht auf iPhone/iPad.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Chars = { info: any; control: any; records: any; device: any };

type Log = { id: string; text: string; ok: boolean; at: string };

const RECORDS_PER_READ = 15;

export function BandReader() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; label: string }>>([]);
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [current, setCurrent] = useState<BandInfo | null>(null);
  const [needsId, setNeedsId] = useState(false);
  const [newId, setNewId] = useState("");
  const [log, setLog] = useState<Log[]>([]);
  const conn = useRef<Chars | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "bluetooth" in navigator);
    readoutEvents().then((e) => {
      setEvents(e);
      if (e[0]) setEventId(e[0].id);
    });
  }, []);

  const addLog = (text: string, ok: boolean) =>
    setLog((l) => [{ id: crypto.randomUUID(), text, ok, at: new Date().toLocaleTimeString("de-DE") }, ...l].slice(0, 200));

  const write = (bytes: Uint8Array) => conn.current!.control.writeValueWithResponse(bytes);
  const readInfo = async () => parseInfo(await conn.current!.info.readValue());

  const disconnect = () => {
    try {
      conn.current?.device.gatt.disconnect();
    } catch {
      /* schon getrennt */
    }
    conn.current = null;
    setCurrent(null);
    setNeedsId(false);
    setStep(null);
    setBusy(false);
  };

  async function readAll(count: number): Promise<BandRecord[]> {
    const all: BandRecord[] = [];
    for (let i = 0; i < count; i += RECORDS_PER_READ) {
      setStep(`Lese Begegnungen ${i + 1}–${Math.min(i + RECORDS_PER_READ, count)} von ${count} …`);
      await write(u16Cmd(CMD.CURSOR, i));
      all.push(...parseRecords(await conn.current!.records.readValue()));
    }
    return all;
  }

  /** Anmelden, Einstellungen übertragen, auslesen, übernehmen, leeren. */
  async function process(info: BandInfo) {
    setStep("Anmelden …");
    const mac = await bandAuth(info.bandId, toHex(info.nonce));
    await write(new Uint8Array([CMD.AUTH, ...fromHex(mac)]));

    setStep("Einstellungen übertragen …");
    await write(encodeParams(await bandParams()));

    const fresh = await readInfo();
    const records = await readAll(fresh.recordCount);

    setStep("Übernehme in die Datenbank …");
    const res = await bandImport({
      eventId,
      bandId: fresh.bandId,
      boot: fresh.boot,
      uptimeS: fresh.uptimeS,
      batteryPct: fresh.batteryPct,
      records,
    });

    // Erst löschen, wenn der Server alles hat.
    setStep("Band leeren …");
    await write(u16Cmd(CMD.CLEAR, fresh.recordCount));

    const clinks = records.filter((r) => r.kind === KIND.CLINK).length;
    const dances = records.length - clinks;
    addLog(
      `Band ${fresh.bandId}: ${records.length} Begegnungen (${clinks} Clink, ${dances} Tanz) → ${res.neu} neu in „${res.event}“` +
        (res.ohneCheckin ? `, ${res.ohneCheckin} ohne Check-in` : "") +
        (res.ungenau ? `, ${res.ungenau} mit ungefährer Uhrzeit` : "") +
        ` · Akku ${fresh.batteryPct} %`,
      true,
    );
  }

  async function connect() {
    if (!eventId) return addLog("Bitte zuerst ein Event wählen.", false);
    setBusy(true);
    try {
      setStep("Band auswählen …");
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: "CLINK" }],
        optionalServices: [UUID_SERVICE],
      });
      setStep(`Verbinde mit ${device.name} …`);
      const server = await device.gatt.connect();
      const svc = await server.getPrimaryService(UUID_SERVICE);
      conn.current = {
        device,
        info: await svc.getCharacteristic(UUID_INFO),
        control: await svc.getCharacteristic(UUID_CONTROL),
        records: await svc.getCharacteristic(UUID_RECORDS),
      };
      device.addEventListener("gattserverdisconnected", () => {
        conn.current = null;
      });

      const info = await readInfo();
      setCurrent(info);
      if (!info.provisioned) {
        setNeedsId(true);
        setStep(null);
        setBusy(false);
        return; // weiter mit provision()
      }
      await process(info);
      disconnect();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) addLog(`Fehler: ${msg}`, false);
      disconnect();
    }
  }

  async function provision() {
    const id = Number(newId.trim().replace(/^ID[:\s]*/i, ""));
    if (!Number.isInteger(id) || id <= 0) return addLog("Geräte-ID muss eine Zahl sein, z. B. 778775.", false);
    setBusy(true);
    try {
      setStep("Band einrichten …");
      const key = fromHex(await bandProvision(id, null));
      const cmd = new Uint8Array(1 + 4 + key.length);
      cmd[0] = CMD.PROVISION;
      new DataView(cmd.buffer).setUint32(1, id, true);
      cmd.set(key, 5);
      await write(cmd);
      await write(encodeParams(await bandParams()));
      await write(new Uint8Array([CMD.BUZZ]));
      addLog(`Band ${id} eingerichtet. Es vibriert jetzt zur Bestätigung.`, true);
      setNewId("");
      disconnect();
    } catch (e) {
      addLog(`Einrichten fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, false);
      disconnect();
    }
  }

  if (supported === false) {
    return (
      <div className="alert">
        Dieser Browser kann kein Bluetooth. Bitte <strong>Chrome oder Edge auf einem Laptop oder Android-Handy</strong> verwenden. Auf iPhone und
        iPad geht es nicht.
      </div>
    );
  }

  return (
    <div className={styles.reader}>
      <label className="field">
        <span>Begegnungen gehören zu</span>
        <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={busy}>
          {events.length === 0 && <option value="">Kein offenes Event – bitte zuerst anlegen</option>}
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>

      {needsId ? (
        <div className={styles.provision}>
          <p>
            <strong>Neues Band erkannt.</strong> Gib die Geräte-ID vom Aufkleber ein (z. B. <code>778775</code>).
          </p>
          <div className={styles.row}>
            <input
              className="input"
              inputMode="numeric"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="Geräte-ID"
              autoFocus
            />
            <button type="button" className="btn btn-pink" onClick={provision} disabled={busy}>
              Einrichten
            </button>
          </div>
          <button type="button" className="btn btn-ghost" onClick={disconnect} disabled={busy}>
            Abbrechen
          </button>
        </div>
      ) : (
        <button type="button" className={`btn btn-pink ${styles.big}`} onClick={connect} disabled={busy || !eventId}>
          {busy ? (step ?? "…") : "🔗 Band verbinden"}
        </button>
      )}

      {current && (
        <p className={styles.current}>
          {current.provisioned ? `Band ${current.bandId}` : "Neues Band"} · Firmware {current.fw} · Akku {current.batteryPct} % ·{" "}
          {current.recordCount} Begegnungen gespeichert
        </p>
      )}

      <ul className={styles.log}>
        {log.map((l) => (
          <li key={l.id} className={l.ok ? styles.ok : styles.err}>
            <span>{l.at}</span> {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
