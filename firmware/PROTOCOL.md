# CLINK – Bluetooth-Protokoll (Version 1)

Gilt für Firmware (`src/proto.h`) und Website (`lib/band-protocol.ts`). Alle Zahlen sind little endian.

## 1. Bänder untereinander (Advertising)

Jedes Band sendet als Manufacturer Specific Data (Company ID `0xFFFF`) 13 Byte:

| Offset | Typ | Feld |
| --- | --- | --- |
| 0 | u16 | Company ID `0xFFFF` |
| 2 | 2 × char | `'C' 'L'` |
| 4 | u8 | Protokollversion (1) |
| 5 | u8 | Flags: `0x01` Stoß aktiv, `0x02` lädt |
| 6 | u32 | Band-ID |
| 10 | u16 | ms seit dem Stoß, `0xFFFF` = keiner |
| 12 | u8 | Stoß-Zähler |

- **Normal:** alle 250 ms senden, 60 ms von 300 ms zuhören.
- **Nach einem Stoß:** 400 ms lang alle 20 ms senden, dabei das Alter alle 10 ms aktualisieren und durchgehend zuhören.
- Der Empfänger rechnet `Stoßzeit = Empfangszeit − Alter` und vergleicht mit dem eigenen Stoß: `|Δ| ≤ window_ms + 25 ms` und `RSSI ≥ clink_rssi`.
- Der Gerätename im Scan Response ist `CLINK-<ID>` bzw. `CLINK-NEU`.

## 2. Auslesen (GATT)

Service `7a3e0001-5c1e-4c1a-9c1b-c11c00b0c11c`:

| UUID (`7a3e000X-…`) | Zugriff | Inhalt |
| --- | --- | --- |
| `0002` INFO | lesen | 36 Byte: proto u8, flags u8 (1 eingerichtet, 2 angemeldet, 4 lädt), fw 3×u8, Akku % u8, Akku mV u16, Band-ID u32, Startzähler u16, Laufzeit s u32, Anzahl u16, Nonce 16 Byte |
| `0003` CONTROL | schreiben | Befehl (siehe unten) |
| `0004` RECORDS | lesen (angemeldet) | bis zu 15 Einträge à 16 Byte ab Cursor |
| `0005` PARAMS | lesen | aktuelle Einstellungen, 12 Byte |

**Eintrag (16 Byte):** Gegenüber u32, Zeit s seit Start u32, Startzähler u16, Art u8 (1 Clink, 2 Tanz), RSSI i8, Markierung u32 `0x31424C43`. Einträge mit Gegenüber 0 oder falscher Markierung sind unvollständig und werden übersprungen.

**Einstellungen (12 Byte):** Stoß mg u16, Clink-RSSI i8, frei u8, Zeitfenster ms u16, Paartanz an u8, Paartanz-RSSI i8, Paartanz-Sekunden u8, Paartanz-Fenster s u8, frei 2 Byte.

**Befehle an CONTROL:**

| Byte | Befehl | Daten | Anmeldung nötig |
| --- | --- | --- | --- |
| `01` | AUTH | 32 Byte HMAC | – |
| `02` | CURSOR | u16 Index | ja |
| `03` | CLEAR | u16 erwartete Anzahl (Schutz vor Datenverlust) | ja |
| `04` | PARAMS | 12 Byte Einstellungen | ja |
| `05` | PROVISION | u32 Band-ID + 32 Byte Schlüssel | nur bei bereits eingerichteten Bändern |
| `06` | BUZZ | – | ja |

## 3. Anmeldung

- **Schlüssel pro Band:** `key = HMAC-SHA256(BAND_MASTER_KEY, "CLINK-BAND-KEY" | band_id)`. Er wird beim Einrichten aufs Band geschrieben. `BAND_MASTER_KEY` liegt nur auf dem Server.
- **Bei jeder Verbindung:** Das Band erzeugt eine neue Nonce (in INFO). Der Server berechnet `HMAC-SHA256(key, "CLINK-AUTH" | nonce | band_id)`, der Browser schreibt das Ergebnis per AUTH.
- Ohne Anmeldung trennt das Band nach 20 Sekunden. So kann niemand auf der Tanzfläche Bänder auslesen oder blockieren.

Auf Band (tinycrypt) und Server (Node) geprüft: Beide berechnen identische Werte.
