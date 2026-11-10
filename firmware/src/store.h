/* Einstellungen (Band-ID, Schlüssel, Schwellen) und Begegnungs-Log im Flash. */
#ifndef CLINK_STORE_H
#define CLINK_STORE_H

#include <stdbool.h>
#include <stdint.h>
#include "proto.h"

struct store_cfg {
	uint32_t band_id; /* 0 = noch nicht eingerichtet */
	uint8_t key[CLINK_KEY_LEN];
	struct clink_params params;
	uint16_t boot;
};

int store_init(void);
const struct store_cfg *store_cfg(void);
bool store_provisioned(void);
int store_set_params(const struct clink_params *p);
int store_provision(uint32_t band_id, const uint8_t key[CLINK_KEY_LEN]);

uint16_t store_log_count(void);
uint16_t store_log_capacity(void);
int store_log_append(const struct clink_record *r);
/* Liest Eintrag index; -ENOENT wenn unvollständig geschrieben (überspringen). */
int store_log_read(uint16_t index, struct clink_record *out);
int store_log_clear(void);

#endif
