// Bluetooth-Protokoll der Armbänder (Gegenstück zu firmware/src/proto.h).
// Läuft im Browser (Web Bluetooth) und auf dem Server.

export const PROTO_VERSION = 1;

const uuid = (n: number) => `7a3e${n.toString(16).padStart(4, "0")}-5c1e-4c1a-9c1b-c11c00b0c11c`;
export const UUID_SERVICE = uuid(0x0001);
export const UUID_INFO = uuid(0x0002);
export const UUID_CONTROL = uuid(0x0003);
export const UUID_RECORDS = uuid(0x0004);
export const UUID_PARAMS = uuid(0x0005);

export const CMD = { AUTH: 0x01, CURSOR: 0x02, CLEAR: 0x03, PARAMS: 0x04, PROVISION: 0x05, BUZZ: 0x06 } as const;

export const RECORD_SIZE = 16;
export const RECORD_MARK = 0x31424c43;
export const KIND = { CLINK: 1, DANCE: 2 } as const;

export type BandInfo = {
  proto: number;
  provisioned: boolean;
  authed: boolean;
  charging: boolean;
  fw: string;
  batteryPct: number;
  batteryMv: number;
  bandId: number;
  boot: number;
  uptimeS: number;
  recordCount: number;
  nonce: Uint8Array;
};

export function parseInfo(v: DataView): BandInfo {
  const flags = v.getUint8(1);
  return {
    proto: v.getUint8(0),
    provisioned: (flags & 1) !== 0,
    authed: (flags & 2) !== 0,
    charging: (flags & 4) !== 0,
    fw: `${v.getUint8(2)}.${v.getUint8(3)}.${v.getUint8(4)}`,
    batteryPct: v.getUint8(5),
    batteryMv: v.getUint16(6, true),
    bandId: v.getUint32(8, true),
    boot: v.getUint16(12, true),
    uptimeS: v.getUint32(14, true),
    recordCount: v.getUint16(18, true),
    nonce: new Uint8Array(v.buffer.slice(v.byteOffset + 20, v.byteOffset + 36)),
  };
}

export type BandRecord = { peer: number; tS: number; boot: number; kind: number; rssi: number };

/** Liest Einträge; unvollständig geschriebene (peer 0 oder falsche Markierung) fallen weg. */
export function parseRecords(v: DataView): BandRecord[] {
  const out: BandRecord[] = [];
  for (let o = 0; o + RECORD_SIZE <= v.byteLength; o += RECORD_SIZE) {
    const peer = v.getUint32(o, true);
    if (peer === 0 || v.getUint32(o + 12, true) !== RECORD_MARK) continue;
    out.push({
      peer,
      tS: v.getUint32(o + 4, true),
      boot: v.getUint16(o + 8, true),
      kind: v.getUint8(o + 10),
      rssi: v.getInt8(o + 11),
    });
  }
  return out;
}

export type BandParams = {
  shockMg: number;
  clinkRssi: number;
  windowMs: number;
  danceEnabled: boolean;
  danceRssi: number;
  danceSamples: number;
  danceWindowS: number;
};

export function encodeParams(p: BandParams): Uint8Array {
  const b = new Uint8Array(1 + 12);
  const v = new DataView(b.buffer);
  b[0] = CMD.PARAMS;
  v.setUint16(1, p.shockMg, true);
  v.setInt8(3, p.clinkRssi);
  v.setUint16(5, p.windowMs, true);
  v.setUint8(7, p.danceEnabled ? 1 : 0);
  v.setInt8(8, p.danceRssi);
  v.setUint8(9, p.danceSamples);
  v.setUint8(10, p.danceWindowS);
  return b;
}

export function u16Cmd(cmd: number, value: number): Uint8Array {
  const b = new Uint8Array(3);
  b[0] = cmd;
  new DataView(b.buffer).setUint16(1, value, true);
  return b;
}

export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));
