/*
 * CLINK-Armband – Firmware für den KKM W59 (nRF52832).
 *
 * Ablauf:
 *   Tanzfläche: Stoß spüren → per Bluetooth melden und zuhören → passt ein
 *   gleichzeitiger Stoß eines nahen Bandes, Begegnung speichern und vibrieren.
 *   Ladekontakte: keine Begegnungen, Band wartet aufs Auslesen.
 */
#include <zephyr/kernel.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/logging/log.h>

#include "accel.h"
#include "clink_logic.h"
#include "gatt.h"
#include "hw.h"
#include "radio.h"
#include "store.h"
#include "version.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

#define LOW_BATT_PCT 15

static struct cl_state logic;
static K_MUTEX_DEFINE(logic_lock);
static bool charging;
static bool connected;

/* ---------- Begegnungen speichern (außerhalb des Bluetooth-Threads) ---------- */

struct encounter {
	uint32_t peer;
	uint8_t kind;
	int8_t rssi;
	int64_t at_ms;
};

K_MSGQ_DEFINE(encounter_q, sizeof(struct encounter), 16, 4);

static void save_work_fn(struct k_work *w)
{
	struct encounter e;

	ARG_UNUSED(w);
	while (k_msgq_get(&encounter_q, &e, K_NO_WAIT) == 0) {
		struct clink_record r = {
			.peer_id = e.peer,
			.t_s = (uint32_t)(e.at_ms / 1000),
			.boot = store_cfg()->boot,
			.kind = e.kind,
			.rssi = e.rssi,
			.mark = CLINK_RECORD_MARK,
		};
		int err = store_log_append(&r);

		LOG_INF("Begegnung mit %u (%s, %d dBm)%s", e.peer, e.kind == CLINK_KIND_CLINK ? "Clink" : "Tanz",
			e.rssi, err ? " – NICHT gespeichert" : "");
		hw_signal(HW_CLINK);
	}
}
static K_WORK_DEFINE(save_work, save_work_fn);

/* Aufruf aus der Logik, Mutex ist gehalten. */
static void on_encounter(uint32_t peer, uint8_t kind, int8_t rssi, void *user)
{
	struct encounter e = {.peer = peer, .kind = kind, .rssi = rssi, .at_ms = k_uptime_get()};

	ARG_UNUSED(user);
	if (k_msgq_put(&encounter_q, &e, K_NO_WAIT) == 0) {
		k_work_submit(&save_work);
	}
}

/* ---------- Ereignisse ---------- */

static void on_shock(int64_t at_ms)
{
	if (charging || !store_provisioned()) {
		return;
	}
	k_mutex_lock(&logic_lock, K_FOREVER);
	cl_on_own_shock(&logic, at_ms);
	k_mutex_unlock(&logic_lock);
	radio_shock(at_ms);
}

static void on_adv(int64_t now_ms, const struct clink_adv *adv, int8_t rssi)
{
	if (charging || !store_provisioned()) {
		return;
	}
	k_mutex_lock(&logic_lock, K_FOREVER);
	cl_on_adv(&logic, now_ms, adv, rssi);
	k_mutex_unlock(&logic_lock);
}

static void on_touch(void)
{
	int mv = hw_battery_mv();

	if (!store_provisioned()) {
		hw_signal(HW_NOT_READY);
	} else if (mv > 0 && hw_battery_pct(mv) < LOW_BATT_PCT) {
		hw_signal(HW_LOW_BATT);
	} else {
		hw_signal(HW_OK);
	}
}

static void apply_mode(void)
{
	accel_enable(!charging);
	if (!connected) {
		radio_set_mode(charging ? RADIO_CHARGING : RADIO_NIGHT);
	}
}

static void on_usb(bool present)
{
	charging = present;
	LOG_INF("%s", present ? "An den Ladekontakten" : "Vom Ladegerät genommen");
	apply_mode();
}

/* ---------- Auslesen ---------- */

static void on_provisioned(uint32_t band_id)
{
	k_mutex_lock(&logic_lock, K_FOREVER);
	logic.self_id = band_id;
	k_mutex_unlock(&logic_lock);
	radio_set_band_id(band_id);
	hw_signal(HW_OK);
}

static void on_params(const struct clink_params *p)
{
	k_mutex_lock(&logic_lock, K_FOREVER);
	cl_set_params(&logic, p);
	k_mutex_unlock(&logic_lock);
	accel_set_threshold(p->shock_mg);
}

static void on_cleared(void)
{
	k_mutex_lock(&logic_lock, K_FOREVER);
	cl_forget_all(&logic);
	k_mutex_unlock(&logic_lock);
	hw_signal(HW_DONE);
}

static void on_connected(void)
{
	connected = true;
}

static void on_disconnected(void)
{
	connected = false;
	radio_resume();
	apply_mode();
}

static const struct gatt_cbs gatt_callbacks = {
	.provisioned = on_provisioned,
	.params_changed = on_params,
	.cleared = on_cleared,
	.connected = on_connected,
	.disconnected = on_disconnected,
};

/* ---------- Start ---------- */

static void load_met(void)
{
	struct clink_record r;

	for (uint16_t i = 0; i < store_log_count(); i++) {
		if (store_log_read(i, &r) == 0) {
			cl_mark_met(&logic, r.peer_id);
		}
	}
}

int main(void)
{
	int err;

	LOG_INF("CLINK Firmware %d.%d.%d", FW_MAJOR, FW_MINOR, FW_PATCH);

	err = hw_init(on_touch, on_usb);
	if (err) {
		LOG_ERR("Hardware: %d", err);
	}
	err = store_init();
	if (err) {
		LOG_ERR("Speicher: %d", err);
	}

	const struct store_cfg *cfg = store_cfg();

	cl_init(&logic, cfg->band_id, &cfg->params, on_encounter, NULL);
	load_met();

	err = bt_enable(NULL);
	if (err) {
		LOG_ERR("Bluetooth: %d", err);
		hw_signal(HW_LOW_BATT);
		return 0;
	}
	gatt_init(&gatt_callbacks);
	radio_init(on_adv);
	radio_set_band_id(cfg->band_id);

	err = accel_init(on_shock);
	if (err) {
		LOG_ERR("Bewegungssensor: %d", err);
	} else {
		accel_set_threshold(cfg->params.shock_mg);
	}

	charging = hw_usb_present();
	apply_mode();
	hw_signal(store_provisioned() ? HW_BOOT : HW_NOT_READY);
	return 0;
}

/* Bei einem schweren Fehler neu starten statt stehen zu bleiben (Debug-Builds: anhalten). */
#include <zephyr/fatal.h>
#include <zephyr/sys/reboot.h>
#include <zephyr/logging/log_ctrl.h>

void k_sys_fatal_error_handler(unsigned int reason, const struct arch_esf *esf)
{
	ARG_UNUSED(esf);
#ifdef CONFIG_LOG
	LOG_PANIC();
#endif
	LOG_ERR("Schwerer Fehler %u, Neustart", reason);
#ifdef CONFIG_ASSERT
	k_fatal_halt(reason);
#else
	sys_reboot(SYS_REBOOT_COLD);
#endif
	CODE_UNREACHABLE;
}
