/*
 * CLINK – gemeinsame Formate von Firmware und Website.
 * Ausführlich beschrieben in firmware/PROTOCOL.md. Bei Änderungen
 * CLINK_PROTO_VERSION erhöhen und app/admin/auslesen anpassen.
 */
#ifndef CLINK_PROTO_H
#define CLINK_PROTO_H

#include <stdint.h>

#define CLINK_PROTO_VERSION 1

/* ---------- Advertising (Bänder untereinander) ---------- */

/* Manufacturer Specific Data, Company ID 0xFFFF = "keine Firma" (nur für Tests/Prototypen) */
#define CLINK_COMPANY_ID 0xFFFF
#define CLINK_MAGIC0 'C'
#define CLINK_MAGIC1 'L'

#define CLINK_ADV_FLAG_SHOCK 0x01    /* Band hat gerade einen Stoß gespürt */
#define CLINK_ADV_FLAG_CHARGING 0x02 /* Band liegt an den Ladekontakten */

#define CLINK_NO_SHOCK 0xFFFF

struct __attribute__((packed)) clink_adv {
	uint16_t company;      /* CLINK_COMPANY_ID, little endian */
	uint8_t magic[2];      /* 'C' 'L' */
	uint8_t version;       /* CLINK_PROTO_VERSION */
	uint8_t flags;         /* CLINK_ADV_FLAG_* */
	uint32_t band_id;      /* Geräte-ID vom Aufkleber, z. B. 778775 */
	uint16_t shock_age_ms; /* ms seit dem eigenen Stoß, CLINK_NO_SHOCK wenn keiner */
	uint8_t shock_seq;     /* zählt pro Stoß hoch */
};

/* ---------- Gespeicherte Begegnung (Flash, 16 Byte) ---------- */

#define CLINK_KIND_CLINK 1 /* Handgelenke angestoßen */
#define CLINK_KIND_DANCE 2 /* lange sehr nah, z. B. Paartanz */

#define CLINK_RECORD_MARK 0x31424C43u /* "CLB1": Eintrag vollständig geschrieben */

struct __attribute__((packed)) clink_record {
	uint32_t peer_id; /* Band-ID des Gegenübers */
	uint32_t t_s;     /* Sekunden seit Start (siehe boot) */
	uint16_t boot;    /* Startzähler, um Zeitstempel nach Neustart einzuordnen */
	uint8_t kind;     /* CLINK_KIND_* */
	int8_t rssi;      /* Signalstärke in dBm */
	uint32_t mark;    /* CLINK_RECORD_MARK */
};

/* ---------- Einstellungen ---------- */

struct __attribute__((packed)) clink_params {
	uint16_t shock_mg;     /* Stoß-Schwelle in mg, z. B. 2500 = 2,5 g */
	int8_t clink_rssi;     /* Mindest-Signalstärke beim Anstoßen, z. B. -45 dBm */
	uint8_t reserved0;
	uint16_t window_ms;    /* beide Stöße höchstens so weit auseinander, z. B. 100 ms */
	uint8_t dance_enabled; /* Paartanz verbindet automatisch (1) oder nicht (0) */
	int8_t dance_rssi;     /* Mindest-Signalstärke für "sehr nah", z. B. -55 dBm */
	uint8_t dance_samples; /* so viele Sekunden mit Nähe ... */
	uint8_t dance_window_s; /* ... innerhalb dieses Fensters (max. 64 s) */
	uint8_t reserved1[2];
};

#define CLINK_PARAMS_DEFAULT                                                               \
	{                                                                                  \
		.shock_mg = 2500, .clink_rssi = -45, .window_ms = 100, .dance_enabled = 1, \
		.dance_rssi = -55, .dance_samples = 25, .dance_window_s = 60,              \
	}

/* ---------- GATT (Auslesen am Ausgang per Web Bluetooth) ---------- */

/* Basis-UUID 7a3e0000-5c1e-4c1a-9c1b-c11c00b0c11c, die 16-Bit-Stelle variiert */
#define CLINK_UUID(x) BT_UUID_128_ENCODE(0x7a3e0000 + (x), 0x5c1e, 0x4c1a, 0x9c1b, 0xc11c00b0c11c)
#define CLINK_UUID_SERVICE CLINK_UUID(0x0001)
#define CLINK_UUID_INFO CLINK_UUID(0x0002)    /* read: struct clink_info */
#define CLINK_UUID_CONTROL CLINK_UUID(0x0003) /* write: Befehl, siehe CLINK_CMD_* */
#define CLINK_UUID_RECORDS CLINK_UUID(0x0004) /* read: bis zu 15 Einträge ab Cursor */
#define CLINK_UUID_PARAMS CLINK_UUID(0x0005)  /* read: struct clink_params */

#define CLINK_RECORDS_PER_READ 15 /* 15 x 16 = 240 Byte, passt in eine MTU von 247 */

#define CLINK_INFO_FLAG_PROVISIONED 0x01
#define CLINK_INFO_FLAG_AUTHED 0x02
#define CLINK_INFO_FLAG_CHARGING 0x04

struct __attribute__((packed)) clink_info {
	uint8_t proto;          /* CLINK_PROTO_VERSION */
	uint8_t flags;          /* CLINK_INFO_FLAG_* */
	uint8_t fw[3];          /* Firmware-Version major, minor, patch */
	uint8_t battery_pct;
	uint16_t battery_mv;
	uint32_t band_id;       /* 0 = noch nicht eingerichtet */
	uint16_t boot;
	uint32_t uptime_s;
	uint16_t record_count;
	uint8_t nonce[16];      /* für die Anmeldung, neu pro Verbindung */
};

/* Befehle an CONTROL: erstes Byte = Befehl */
#define CLINK_CMD_AUTH 0x01      /* + 32 Byte HMAC-SHA256(key, "CLINK-AUTH" | nonce | band_id) */
#define CLINK_CMD_CURSOR 0x02    /* + uint16 Index: ab hier liefert RECORDS */
#define CLINK_CMD_CLEAR 0x03     /* + uint16 erwartete Anzahl: löscht alle Einträge */
#define CLINK_CMD_PARAMS 0x04    /* + struct clink_params */
#define CLINK_CMD_PROVISION 0x05 /* + uint32 band_id + 32 Byte Schlüssel */
#define CLINK_CMD_BUZZ 0x06      /* kurz vibrieren und blinken: "welches Band ist das?" */

#define CLINK_KEY_LEN 32
#define CLINK_AUTH_LABEL "CLINK-AUTH"

#endif /* CLINK_PROTO_H */
