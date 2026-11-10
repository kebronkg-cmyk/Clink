/*
 * Erkennungslogik ohne Hardware-Abhängigkeit (auf dem PC testbar, siehe test/).
 *
 * Anstoßen: Beide Bänder spüren einen Stoß, senden das sofort per Bluetooth
 * und hören gleichzeitig zu. Eine Begegnung zählt, wenn
 *   1. beide Stöße höchstens window_ms auseinander liegen und
 *   2. das andere Band dabei sehr nah war (RSSI >= clink_rssi).
 * Paartanz: Das andere Band war in dance_samples der letzten dance_window_s
 * Sekunden sehr nah (RSSI >= dance_rssi).
 * Pro Paar wird nur die erste Begegnung gemeldet.
 */
#ifndef CLINK_LOGIC_H
#define CLINK_LOGIC_H

#include <stdbool.h>
#include <stdint.h>
#include "proto.h"

#define CL_MAX_PEERS 32  /* gleichzeitig verfolgte Bänder in Reichweite */
#define CL_MAX_MET 512   /* gemerkte Begegnungen pro Abend */
#define CL_SHOCK_MEMORY_MS 1000
#define CL_ADV_JITTER_MS 25 /* Ungenauigkeit des Alters durch das Sendeintervall */

typedef void (*cl_encounter_cb)(uint32_t peer_id, uint8_t kind, int8_t rssi, void *user);

struct cl_peer {
	uint32_t id;
	int64_t last_seen_ms;
	/* Stoß des Gegenübers */
	int64_t shock_ms; /* geschätzter Zeitpunkt, 0 = keiner */
	uint8_t shock_seq;
	int8_t shock_rssi;
	/* Paartanz: Bit i = Nähe in Sekunde (dance_sec - i) */
	uint64_t dance_mask;
	int64_t dance_sec;
};

struct cl_state {
	struct clink_params p;
	uint32_t self_id;
	int64_t own_shock_ms; /* 0 = keiner */
	struct cl_peer peers[CL_MAX_PEERS];
	uint32_t met[CL_MAX_MET];
	uint16_t met_count;
	cl_encounter_cb cb;
	void *user;
};

void cl_init(struct cl_state *s, uint32_t self_id, const struct clink_params *p, cl_encounter_cb cb,
	     void *user);
void cl_set_params(struct cl_state *s, const struct clink_params *p);

/* Bereits gespeicherte Begegnungen beim Start einlesen bzw. nach dem Auslesen vergessen. */
void cl_mark_met(struct cl_state *s, uint32_t peer_id);
bool cl_has_met(const struct cl_state *s, uint32_t peer_id);
void cl_forget_all(struct cl_state *s);

/* Eigener Stoß zum Zeitpunkt now_ms (Uptime). */
void cl_on_own_shock(struct cl_state *s, int64_t now_ms);

/* Advertising eines anderen Bandes empfangen. */
void cl_on_adv(struct cl_state *s, int64_t now_ms, const struct clink_adv *adv, int8_t rssi);

#endif /* CLINK_LOGIC_H */
