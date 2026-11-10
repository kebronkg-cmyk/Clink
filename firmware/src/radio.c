#include "radio.h"

#include <stdio.h>
#include <string.h>
#include <zephyr/kernel.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/gap.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/byteorder.h>

LOG_MODULE_REGISTER(radio, LOG_LEVEL_INF);

/*
 * Normalbetrieb: alle 250 ms senden, 20 % der Zeit zuhören (Paartanz, fremde Stöße).
 * Nach einem Stoß 400 ms lang: alle 20 ms senden und durchgehend zuhören.
 * Geschätzter Verbrauch ~1,2 mA, bei 90 mAh also gut 3 Tage.
 */
#define ADV_SLOW_MS 250
#define ADV_FAST_MS 20
#define SCAN_SLOW_INTERVAL_MS 300
#define SCAN_SLOW_WINDOW_MS 60
#define SCAN_FAST_MS 30
#define SHOCK_BURST_MS 400
#define AGE_UPDATE_MS 10

#define MS_TO_ADV(ms) ((ms) * 8 / 5)  /* Einheit 0,625 ms */
#define MS_TO_SCAN(ms) ((ms) * 8 / 5) /* Einheit 0,625 ms */

static radio_adv_cb adv_cb;
static enum radio_mode mode = RADIO_OFF;
static struct clink_adv payload = {
	.magic = {CLINK_MAGIC0, CLINK_MAGIC1},
	.version = CLINK_PROTO_VERSION,
	.shock_age_ms = CLINK_NO_SHOCK,
};
static char name[20] = "CLINK";
static int64_t shock_at;
static bool burst;
static bool adv_on;
static bool scan_on;
static K_MUTEX_DEFINE(lock);

static const struct bt_data sd_template[] = {
	BT_DATA(BT_DATA_NAME_COMPLETE, name, 5),
};

/* ---------- Senden ---------- */

static void fill_payload(void)
{
	payload.company = sys_cpu_to_le16(CLINK_COMPANY_ID);
	payload.flags = 0;
	if (mode == RADIO_CHARGING) {
		payload.flags |= CLINK_ADV_FLAG_CHARGING;
	}
	if (burst) {
		int64_t age = k_uptime_get() - shock_at;

		payload.flags |= CLINK_ADV_FLAG_SHOCK;
		payload.shock_age_ms = sys_cpu_to_le16((uint16_t)MIN(age, 0xFFFE));
	} else {
		payload.shock_age_ms = sys_cpu_to_le16(CLINK_NO_SHOCK);
	}
}

static int adv_start(uint16_t interval_ms)
{
	const struct bt_data ad[] = {
		BT_DATA_BYTES(BT_DATA_FLAGS, (BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR)),
		BT_DATA(BT_DATA_MANUFACTURER_DATA, &payload, sizeof(payload)),
	};
	struct bt_data sd[] = {sd_template[0]};
	const struct bt_le_adv_param param = BT_LE_ADV_PARAM_INIT(
		BT_LE_ADV_OPT_CONN, MS_TO_ADV(interval_ms), MS_TO_ADV(interval_ms) + 8, NULL);
	int err;

	sd[0].data_len = strlen(name);
	if (adv_on) {
		bt_le_adv_stop();
		adv_on = false;
	}
	fill_payload();
	err = bt_le_adv_start(&param, ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
	if (err && err != -ENOMEM) {
		LOG_WRN("Advertising: %d", err);
	}
	adv_on = (err == 0);
	return err;
}

static void adv_update(void)
{
	const struct bt_data ad[] = {
		BT_DATA_BYTES(BT_DATA_FLAGS, (BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR)),
		BT_DATA(BT_DATA_MANUFACTURER_DATA, &payload, sizeof(payload)),
	};

	if (!adv_on) {
		return;
	}
	fill_payload();
	bt_le_adv_update_data(ad, ARRAY_SIZE(ad), NULL, 0);
}

/* ---------- Zuhören ---------- */

struct parse_ctx {
	const struct clink_adv *adv;
	struct clink_adv copy;
};

static bool parse_ad(struct bt_data *data, void *user)
{
	struct parse_ctx *ctx = user;

	if (data->type == BT_DATA_MANUFACTURER_DATA && data->data_len == sizeof(struct clink_adv)) {
		memcpy(&ctx->copy, data->data, sizeof(ctx->copy));
		if (sys_le16_to_cpu(ctx->copy.company) == CLINK_COMPANY_ID) {
			ctx->copy.band_id = sys_le32_to_cpu(ctx->copy.band_id);
			ctx->copy.shock_age_ms = sys_le16_to_cpu(ctx->copy.shock_age_ms);
			ctx->adv = &ctx->copy;
			return false;
		}
	}
	return true;
}

static void on_scan(const bt_addr_le_t *addr, int8_t rssi, uint8_t type, struct net_buf_simple *ad)
{
	struct parse_ctx ctx = {0};

	ARG_UNUSED(addr);
	if (type != BT_GAP_ADV_TYPE_ADV_IND && type != BT_GAP_ADV_TYPE_ADV_NONCONN_IND) {
		return;
	}
	bt_data_parse(ad, parse_ad, &ctx);
	if (ctx.adv && adv_cb) {
		adv_cb(k_uptime_get(), ctx.adv, rssi);
	}
}

static void scan_set(bool fast)
{
	const struct bt_le_scan_param param = {
		.type = BT_LE_SCAN_TYPE_PASSIVE,
		.options = BT_LE_SCAN_OPT_NONE,
		.interval = fast ? MS_TO_SCAN(SCAN_FAST_MS) : MS_TO_SCAN(SCAN_SLOW_INTERVAL_MS),
		.window = fast ? MS_TO_SCAN(SCAN_FAST_MS) : MS_TO_SCAN(SCAN_SLOW_WINDOW_MS),
	};
	int err;

	if (scan_on) {
		bt_le_scan_stop();
		scan_on = false;
	}
	err = bt_le_scan_start(&param, on_scan);
	if (err) {
		LOG_WRN("Scan: %d", err);
	}
	scan_on = (err == 0);
}

static void scan_off(void)
{
	if (scan_on) {
		bt_le_scan_stop();
		scan_on = false;
	}
}

/* ---------- Stoß-Burst ---------- */

static void age_work_fn(struct k_work *w);
static void burst_end_fn(struct k_work *w);
static K_WORK_DELAYABLE_DEFINE(age_work, age_work_fn);
static K_WORK_DELAYABLE_DEFINE(burst_end_work, burst_end_fn);

static void age_work_fn(struct k_work *w)
{
	ARG_UNUSED(w);
	k_mutex_lock(&lock, K_FOREVER);
	if (burst) {
		adv_update();
		k_work_reschedule(&age_work, K_MSEC(AGE_UPDATE_MS));
	}
	k_mutex_unlock(&lock);
}

static void burst_end_fn(struct k_work *w)
{
	ARG_UNUSED(w);
	k_mutex_lock(&lock, K_FOREVER);
	burst = false;
	if (mode == RADIO_NIGHT) {
		adv_start(ADV_SLOW_MS);
		scan_set(false);
	}
	k_mutex_unlock(&lock);
}

void radio_shock(int64_t shock_ms)
{
	k_mutex_lock(&lock, K_FOREVER);
	if (mode != RADIO_NIGHT) {
		k_mutex_unlock(&lock);
		return;
	}
	shock_at = shock_ms;
	burst = true;
	payload.shock_seq++;
	adv_start(ADV_FAST_MS);
	scan_set(true);
	k_work_reschedule(&age_work, K_MSEC(AGE_UPDATE_MS));
	k_work_reschedule(&burst_end_work, K_MSEC(SHOCK_BURST_MS));
	k_mutex_unlock(&lock);
}

/* ---------- Steuerung ---------- */

void radio_set_band_id(uint32_t band_id)
{
	k_mutex_lock(&lock, K_FOREVER);
	payload.band_id = sys_cpu_to_le32(band_id);
	if (band_id) {
		snprintf(name, sizeof(name), "CLINK-%u", band_id);
	} else {
		snprintf(name, sizeof(name), "CLINK-NEU");
	}
	k_mutex_unlock(&lock);
}

void radio_set_mode(enum radio_mode m)
{
	k_mutex_lock(&lock, K_FOREVER);
	mode = m;
	burst = false;
	switch (m) {
	case RADIO_NIGHT:
		adv_start(ADV_SLOW_MS);
		scan_set(false);
		break;
	case RADIO_CHARGING:
		scan_off();
		adv_start(ADV_SLOW_MS);
		break;
	case RADIO_OFF:
		scan_off();
		if (adv_on) {
			bt_le_adv_stop();
			adv_on = false;
		}
		break;
	}
	k_mutex_unlock(&lock);
}

void radio_resume(void)
{
	k_mutex_lock(&lock, K_FOREVER);
	adv_on = false; /* durch die Verbindung beendet */
	if (mode != RADIO_OFF) {
		adv_start(burst ? ADV_FAST_MS : ADV_SLOW_MS);
	}
	k_mutex_unlock(&lock);
}

int radio_init(radio_adv_cb cb)
{
	adv_cb = cb;
	return 0;
}
