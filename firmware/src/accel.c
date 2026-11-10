#include "accel.h"

#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/sensor.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(accel, LOG_LEVEL_INF);

/* CTRL_REG2: Hochpassfilter für die Click-Erkennung, damit die Schwerkraft nicht mitzählt. */
#define LIS3DH_HPCLICK BIT(2)
/* Ein Stoß ist kurz: höchstens 10 Messwerte bei 400 Hz = 25 ms über der Schwelle. */
#define CLICK_TIME_LIMIT_SAMPLES 10

static const struct device *const acc = DEVICE_DT_GET(DT_ALIAS(accel0));
static void (*shock_cb)(int64_t uptime_ms);
static bool enabled;

static const struct sensor_trigger tap_trig = {
	.type = SENSOR_TRIG_TAP,
	.chan = SENSOR_CHAN_ACCEL_XYZ,
};

static void on_tap(const struct device *dev, const struct sensor_trigger *trig)
{
	ARG_UNUSED(dev);
	ARG_UNUSED(trig);
	if (enabled && shock_cb) {
		shock_cb(k_uptime_get());
	}
}

int accel_set_threshold(uint16_t shock_mg)
{
	struct sensor_value th;

	/* Schwelle in m/s² (1 g = 9,80665 m/s²) */
	sensor_g_to_ms2((int32_t)shock_mg * 1000, &th);
	return sensor_attr_set(acc, SENSOR_CHAN_ACCEL_XYZ, SENSOR_ATTR_SLOPE_TH, &th);
}

void accel_enable(bool on)
{
	enabled = on;
}

int accel_init(void (*on_shock)(int64_t uptime_ms))
{
	struct sensor_value v;
	int err;

	shock_cb = on_shock;
	if (!device_is_ready(acc)) {
		LOG_ERR("LIS3DH nicht bereit");
		return -ENODEV;
	}

	v.val1 = LIS3DH_HPCLICK;
	v.val2 = 0;
	err = sensor_attr_set(acc, SENSOR_CHAN_ACCEL_XYZ, SENSOR_ATTR_CONFIGURATION, &v);
	if (err) {
		LOG_WRN("Hochpassfilter: %d", err);
	}

	v.val1 = CLICK_TIME_LIMIT_SAMPLES;
	v.val2 = 0;
	err = sensor_attr_set(acc, SENSOR_CHAN_ACCEL_XYZ, SENSOR_ATTR_SLOPE_DUR, &v);
	if (err) {
		LOG_WRN("Click-Dauer: %d", err);
	}

	err = sensor_trigger_set(acc, &tap_trig, on_tap);
	if (err) {
		LOG_ERR("Click-Interrupt: %d", err);
		return err;
	}
	enabled = true;
	return 0;
}
