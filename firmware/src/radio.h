/* Bluetooth: eigenes Advertising senden und andere Bänder empfangen. */
#ifndef CLINK_RADIO_H
#define CLINK_RADIO_H

#include <stdint.h>
#include "proto.h"

enum radio_mode {
	RADIO_OFF,
	RADIO_NIGHT,    /* Tanzfläche: senden + zuhören */
	RADIO_CHARGING, /* Ladekontakte: nur auslesbar, keine Begegnungen */
};

typedef void (*radio_adv_cb)(int64_t now_ms, const struct clink_adv *adv, int8_t rssi);

int radio_init(radio_adv_cb cb);
void radio_set_band_id(uint32_t band_id);
void radio_set_mode(enum radio_mode mode);
/* Eigener Stoß: kurz schnell senden (mit Alter des Stoßes) und dicht zuhören. */
void radio_shock(int64_t shock_ms);
/* Nach Verbindungsende wieder senden. */
void radio_resume(void);

#endif
