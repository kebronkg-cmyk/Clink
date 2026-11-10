/* Auslesen am Ausgang: GATT-Dienst für die Admin-Seite (Web Bluetooth). */
#ifndef CLINK_GATT_H
#define CLINK_GATT_H

#include <stdint.h>
#include "proto.h"

struct gatt_cbs {
	void (*provisioned)(uint32_t band_id);
	void (*params_changed)(const struct clink_params *p);
	void (*cleared)(void);
	void (*connected)(void);
	void (*disconnected)(void);
};

int gatt_init(const struct gatt_cbs *cbs);

#endif
