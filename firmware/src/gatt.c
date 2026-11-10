#include "gatt.h"

#include <string.h>
#include <zephyr/kernel.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/logging/log.h>
#include <zephyr/random/random.h>
#include <zephyr/sys/byteorder.h>
#include <tinycrypt/constants.h>
#include <tinycrypt/hmac.h>
#include <tinycrypt/utils.h>

#include "hw.h"
#include "store.h"
#include "version.h"

LOG_MODULE_REGISTER(gatt, LOG_LEVEL_INF);

/* Wer sich nicht innerhalb dieser Zeit anmeldet, wird getrennt (sonst blockiert er das Band). */
#define AUTH_TIMEOUT_S 20

static const struct gatt_cbs *cbs;
static struct bt_conn *current;
static uint8_t nonce[16];
static bool authed;
static uint16_t cursor;

static void auth_timeout_fn(struct k_work *w)
{
	ARG_UNUSED(w);
	if (current && !authed) {
		LOG_INF("Keine Anmeldung, trenne");
		bt_conn_disconnect(current, BT_HCI_ERR_REMOTE_USER_TERM_CONN);
	}
}
static K_WORK_DELAYABLE_DEFINE(auth_timeout, auth_timeout_fn);

/* ---------- Anmeldung: HMAC-SHA256(key, "CLINK-AUTH" | nonce | band_id) ---------- */

static bool check_auth(const uint8_t *mac, size_t len)
{
	const struct store_cfg *c = store_cfg();
	struct tc_hmac_state_struct h;
	uint8_t expected[TC_SHA256_DIGEST_SIZE];
	uint8_t id_le[4];

	if (len != sizeof(expected) || !store_provisioned()) {
		return false;
	}
	sys_put_le32(c->band_id, id_le);
	if (tc_hmac_set_key(&h, c->key, sizeof(c->key)) != TC_CRYPTO_SUCCESS ||
	    tc_hmac_init(&h) != TC_CRYPTO_SUCCESS ||
	    tc_hmac_update(&h, CLINK_AUTH_LABEL, strlen(CLINK_AUTH_LABEL)) != TC_CRYPTO_SUCCESS ||
	    tc_hmac_update(&h, nonce, sizeof(nonce)) != TC_CRYPTO_SUCCESS ||
	    tc_hmac_update(&h, id_le, sizeof(id_le)) != TC_CRYPTO_SUCCESS ||
	    tc_hmac_final(expected, sizeof(expected), &h) != TC_CRYPTO_SUCCESS) {
		return false;
	}
	return _compare(expected, mac, sizeof(expected)) == 0;
}

/* ---------- Characteristics ---------- */

static ssize_t read_info(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf, uint16_t len,
			 uint16_t offset)
{
	const struct store_cfg *c = store_cfg();
	int mv = hw_battery_mv();
	struct clink_info info = {
		.proto = CLINK_PROTO_VERSION,
		.flags = (store_provisioned() ? CLINK_INFO_FLAG_PROVISIONED : 0) |
			 (authed ? CLINK_INFO_FLAG_AUTHED : 0) |
			 (hw_usb_present() ? CLINK_INFO_FLAG_CHARGING : 0),
		.fw = {FW_MAJOR, FW_MINOR, FW_PATCH},
		.battery_pct = mv > 0 ? hw_battery_pct(mv) : 0,
		.battery_mv = sys_cpu_to_le16(mv > 0 ? mv : 0),
		.band_id = sys_cpu_to_le32(c->band_id),
		.boot = sys_cpu_to_le16(c->boot),
		.uptime_s = sys_cpu_to_le32((uint32_t)(k_uptime_get() / 1000)),
		.record_count = sys_cpu_to_le16(store_log_count()),
	};

	memcpy(info.nonce, nonce, sizeof(nonce));
	return bt_gatt_attr_read(conn, attr, buf, len, offset, &info, sizeof(info));
}

static ssize_t read_params(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf, uint16_t len,
			   uint16_t offset)
{
	struct clink_params p = store_cfg()->params;

	p.shock_mg = sys_cpu_to_le16(p.shock_mg);
	p.window_ms = sys_cpu_to_le16(p.window_ms);
	return bt_gatt_attr_read(conn, attr, buf, len, offset, &p, sizeof(p));
}

static ssize_t read_records(struct bt_conn *conn, const struct bt_gatt_attr *attr, void *buf,
			    uint16_t len, uint16_t offset)
{
	struct clink_record recs[CLINK_RECORDS_PER_READ];
	size_t n = 0;

	if (!authed) {
		return BT_GATT_ERR(BT_ATT_ERR_AUTHORIZATION);
	}
	/*
	 * Unvollständige Einträge werden mit peer_id 0 geliefert, damit die
	 * Position stimmt; die Website überspringt sie.
	 */
	for (uint16_t i = cursor; i < store_log_count() && n < ARRAY_SIZE(recs); i++, n++) {
		if (store_log_read(i, &recs[n]) != 0) {
			memset(&recs[n], 0, sizeof(recs[n]));
		}
	}
	return bt_gatt_attr_read(conn, attr, buf, len, offset, recs, n * sizeof(recs[0]));
}

static ssize_t write_control(struct bt_conn *conn, const struct bt_gatt_attr *attr, const void *buf,
			     uint16_t len, uint16_t offset, uint8_t flags)
{
	const uint8_t *d = buf;

	if (offset != 0 || len < 1) {
		return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
	}

	switch (d[0]) {
	case CLINK_CMD_AUTH:
		authed = check_auth(d + 1, len - 1);
		if (!authed) {
			LOG_WRN("Anmeldung fehlgeschlagen");
			return BT_GATT_ERR(BT_ATT_ERR_AUTHORIZATION);
		}
		k_work_cancel_delayable(&auth_timeout);
		return len;

	case CLINK_CMD_PROVISION: {
		/* Neues Band: ohne Anmeldung. Eingerichtetes Band: nur angemeldet (Neuvergabe). */
		if (store_provisioned() && !authed) {
			return BT_GATT_ERR(BT_ATT_ERR_AUTHORIZATION);
		}
		if (len != 1 + 4 + CLINK_KEY_LEN) {
			return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
		}
		uint32_t id = sys_get_le32(d + 1);

		if (id == 0 || store_provision(id, d + 5)) {
			return BT_GATT_ERR(BT_ATT_ERR_UNLIKELY);
		}
		authed = true;
		k_work_cancel_delayable(&auth_timeout);
		if (cbs && cbs->provisioned) {
			cbs->provisioned(id);
		}
		return len;
	}
	}

	/* Alle weiteren Befehle nur nach Anmeldung. */
	if (!authed) {
		return BT_GATT_ERR(BT_ATT_ERR_AUTHORIZATION);
	}

	switch (d[0]) {
	case CLINK_CMD_CURSOR:
		if (len != 3) {
			return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
		}
		cursor = sys_get_le16(d + 1);
		return len;

	case CLINK_CMD_CLEAR:
		/* Nur löschen, was die Website auch gelesen hat. */
		if (len != 3 || sys_get_le16(d + 1) != store_log_count()) {
			return BT_GATT_ERR(BT_ATT_ERR_VALUE_NOT_ALLOWED);
		}
		if (store_log_clear()) {
			return BT_GATT_ERR(BT_ATT_ERR_UNLIKELY);
		}
		cursor = 0;
		if (cbs && cbs->cleared) {
			cbs->cleared();
		}
		return len;

	case CLINK_CMD_PARAMS: {
		struct clink_params p;

		if (len != 1 + sizeof(p)) {
			return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
		}
		memcpy(&p, d + 1, sizeof(p));
		p.shock_mg = sys_le16_to_cpu(p.shock_mg);
		p.window_ms = sys_le16_to_cpu(p.window_ms);
		if (p.shock_mg < 100 || p.shock_mg > 16000 || p.window_ms < 10 || p.window_ms > 2000 ||
		    p.dance_window_s > 64 || p.dance_samples > p.dance_window_s) {
			return BT_GATT_ERR(BT_ATT_ERR_VALUE_NOT_ALLOWED);
		}
		if (store_set_params(&p)) {
			return BT_GATT_ERR(BT_ATT_ERR_UNLIKELY);
		}
		if (cbs && cbs->params_changed) {
			cbs->params_changed(&p);
		}
		return len;
	}

	case CLINK_CMD_BUZZ:
		hw_signal(HW_BUZZ);
		return len;
	}

	return BT_GATT_ERR(BT_ATT_ERR_NOT_SUPPORTED);
}

BT_GATT_SERVICE_DEFINE(clink_svc,
	BT_GATT_PRIMARY_SERVICE(BT_UUID_DECLARE_128(CLINK_UUID_SERVICE)),
	BT_GATT_CHARACTERISTIC(BT_UUID_DECLARE_128(CLINK_UUID_INFO), BT_GATT_CHRC_READ,
			       BT_GATT_PERM_READ, read_info, NULL, NULL),
	BT_GATT_CHARACTERISTIC(BT_UUID_DECLARE_128(CLINK_UUID_CONTROL), BT_GATT_CHRC_WRITE,
			       BT_GATT_PERM_WRITE, NULL, write_control, NULL),
	BT_GATT_CHARACTERISTIC(BT_UUID_DECLARE_128(CLINK_UUID_RECORDS), BT_GATT_CHRC_READ,
			       BT_GATT_PERM_READ, read_records, NULL, NULL),
	BT_GATT_CHARACTERISTIC(BT_UUID_DECLARE_128(CLINK_UUID_PARAMS), BT_GATT_CHRC_READ,
			       BT_GATT_PERM_READ, read_params, NULL, NULL),
);

/* ---------- Verbindung ---------- */

static void on_connected(struct bt_conn *conn, uint8_t err)
{
	if (err) {
		return;
	}
	if (current) {
		bt_conn_disconnect(conn, BT_HCI_ERR_CONN_LIMIT_EXCEEDED);
		return;
	}
	current = bt_conn_ref(conn);
	authed = false;
	cursor = 0;
	sys_csrand_get(nonce, sizeof(nonce));
	k_work_reschedule(&auth_timeout, K_SECONDS(AUTH_TIMEOUT_S));
	if (cbs && cbs->connected) {
		cbs->connected();
	}
}

static void on_disconnected(struct bt_conn *conn, uint8_t reason)
{
	if (conn != current) {
		return;
	}
	bt_conn_unref(current);
	current = NULL;
	authed = false;
	k_work_cancel_delayable(&auth_timeout);
	if (cbs && cbs->disconnected) {
		cbs->disconnected();
	}
}

BT_CONN_CB_DEFINE(conn_cbs) = {
	.connected = on_connected,
	.disconnected = on_disconnected,
};

int gatt_init(const struct gatt_cbs *c)
{
	cbs = c;
	return 0;
}
