#include "store.h"

#include <string.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/settings/settings.h>
#include <zephyr/storage/flash_map.h>

LOG_MODULE_REGISTER(store, LOG_LEVEL_INF);

#define LOG_AREA FIXED_PARTITION_ID(log_partition)
#define REC_SIZE sizeof(struct clink_record)

BUILD_ASSERT(REC_SIZE == 16, "Eintrag muss 16 Byte groß sein");

static struct store_cfg cfg = {.params = CLINK_PARAMS_DEFAULT};
static const struct flash_area *log_fa;
static uint16_t log_count;
static K_MUTEX_DEFINE(lock);

/* ---------- Einstellungen ---------- */

static int cfg_set(const char *name, size_t len, settings_read_cb read_cb, void *cb_arg)
{
	const char *next;

	if (settings_name_steq(name, "id", &next) && len == sizeof(cfg.band_id)) {
		return read_cb(cb_arg, &cfg.band_id, len) < 0 ? -EIO : 0;
	}
	if (settings_name_steq(name, "key", &next) && len == sizeof(cfg.key)) {
		return read_cb(cb_arg, cfg.key, len) < 0 ? -EIO : 0;
	}
	if (settings_name_steq(name, "params", &next) && len == sizeof(cfg.params)) {
		return read_cb(cb_arg, &cfg.params, len) < 0 ? -EIO : 0;
	}
	if (settings_name_steq(name, "boot", &next) && len == sizeof(cfg.boot)) {
		return read_cb(cb_arg, &cfg.boot, len) < 0 ? -EIO : 0;
	}
	return -ENOENT;
}

SETTINGS_STATIC_HANDLER_DEFINE(clink, "clink", NULL, cfg_set, NULL, NULL);

const struct store_cfg *store_cfg(void)
{
	return &cfg;
}

bool store_provisioned(void)
{
	return cfg.band_id != 0;
}

int store_set_params(const struct clink_params *p)
{
	cfg.params = *p;
	return settings_save_one("clink/params", &cfg.params, sizeof(cfg.params));
}

int store_provision(uint32_t band_id, const uint8_t key[CLINK_KEY_LEN])
{
	int err;

	cfg.band_id = band_id;
	memcpy(cfg.key, key, CLINK_KEY_LEN);
	err = settings_save_one("clink/key", cfg.key, sizeof(cfg.key));
	if (!err) {
		err = settings_save_one("clink/id", &cfg.band_id, sizeof(cfg.band_id));
	}
	return err;
}

/* ---------- Begegnungs-Log ---------- */

uint16_t store_log_capacity(void)
{
	return log_fa ? (uint16_t)(log_fa->fa_size / REC_SIZE) : 0;
}

uint16_t store_log_count(void)
{
	return log_count;
}

static bool slot_erased(uint16_t index)
{
	uint8_t buf[REC_SIZE];

	if (flash_area_read(log_fa, (off_t)index * REC_SIZE, buf, sizeof(buf))) {
		return false;
	}
	for (size_t i = 0; i < sizeof(buf); i++) {
		if (buf[i] != 0xFF) {
			return false;
		}
	}
	return true;
}

int store_log_append(const struct clink_record *r)
{
	int err;

	k_mutex_lock(&lock, K_FOREVER);
	if (log_count >= store_log_capacity()) {
		k_mutex_unlock(&lock);
		return -ENOSPC;
	}
	err = flash_area_write(log_fa, (off_t)log_count * REC_SIZE, r, REC_SIZE);
	/* Auch bei Fehler weiterrücken: der Platz ist ggf. teilweise beschrieben. */
	log_count++;
	k_mutex_unlock(&lock);
	return err;
}

int store_log_read(uint16_t index, struct clink_record *out)
{
	int err;

	if (index >= log_count) {
		return -EINVAL;
	}
	err = flash_area_read(log_fa, (off_t)index * REC_SIZE, out, REC_SIZE);
	if (err) {
		return err;
	}
	return out->mark == CLINK_RECORD_MARK ? 0 : -ENOENT;
}

int store_log_clear(void)
{
	int err;

	k_mutex_lock(&lock, K_FOREVER);
	err = flash_area_erase(log_fa, 0, log_fa->fa_size);
	if (!err) {
		log_count = 0;
	}
	k_mutex_unlock(&lock);
	return err;
}

/* ---------- Start ---------- */

int store_init(void)
{
	int err = settings_subsys_init();

	if (err) {
		LOG_ERR("Settings: %d", err);
		return err;
	}
	settings_load_subtree("clink");

	cfg.boot++;
	settings_save_one("clink/boot", &cfg.boot, sizeof(cfg.boot));

	err = flash_area_open(LOG_AREA, &log_fa);
	if (err) {
		LOG_ERR("Log-Bereich: %d", err);
		return err;
	}
	/* Ende des Logs suchen: erster komplett leerer Platz. */
	log_count = 0;
	while (log_count < store_log_capacity() && !slot_erased(log_count)) {
		log_count++;
	}

	LOG_INF("Band %u, Start %u, %u Begegnungen gespeichert", cfg.band_id, cfg.boot, log_count);
	return 0;
}
