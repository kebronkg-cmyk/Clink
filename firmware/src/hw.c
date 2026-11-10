#include "hw.h"

#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/adc.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(hw, LOG_LEVEL_INF);

#define USER_NODE DT_PATH(zephyr_user)

static const struct gpio_dt_spec led_green = GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);
static const struct gpio_dt_spec led_red = GPIO_DT_SPEC_GET(DT_ALIAS(led1), gpios);
static const struct gpio_dt_spec touch = GPIO_DT_SPEC_GET(DT_ALIAS(sw0), gpios);
static const struct gpio_dt_spec motor = GPIO_DT_SPEC_GET(USER_NODE, motor_gpios);
static const struct gpio_dt_spec usb = GPIO_DT_SPEC_GET(USER_NODE, usb_gpios);
static const struct adc_dt_spec batt = ADC_DT_SPEC_GET(USER_NODE);

/* Laut KKM: Li-Ion 3,3 V (leer) bis 4,1 V (voll), Teiler 1:2 vor dem ADC */
#define BATT_MIN_MV 3300
#define BATT_MAX_MV 4100

static void (*touch_cb)(void);
static void (*usb_cb)(bool present);
static struct gpio_callback touch_gpio_cb;
static struct gpio_callback usb_gpio_cb;

/* ---------- Signalmuster ---------- */

struct step {
	uint8_t motor : 1;
	uint8_t green : 1;
	uint8_t red : 1;
	uint16_t ms;
};

#define S(m, g, r, t) {.motor = (m), .green = (g), .red = (r), .ms = (t)}

static const struct step p_boot[] = {S(0, 1, 1, 300), S(0, 0, 0, 0)};
static const struct step p_clink[] = {S(1, 1, 0, 150), S(0, 1, 0, 100), S(1, 1, 0, 150), S(0, 1, 0, 400),
				      S(0, 0, 0, 0)};
static const struct step p_ok[] = {S(0, 1, 0, 200), S(0, 0, 0, 150), S(0, 1, 0, 200), S(0, 0, 0, 0)};
static const struct step p_low[] = {S(0, 0, 1, 200), S(0, 0, 0, 150), S(0, 0, 1, 200), S(0, 0, 0, 150),
				    S(0, 0, 1, 200), S(0, 0, 0, 0)};
static const struct step p_not_ready[] = {S(0, 0, 1, 200), S(0, 1, 0, 200), S(0, 0, 1, 200),
					  S(0, 1, 0, 200), S(0, 0, 0, 0)};
static const struct step p_buzz[] = {S(1, 1, 1, 200), S(0, 0, 0, 150), S(1, 1, 1, 200), S(0, 0, 0, 150),
				     S(1, 1, 1, 200), S(0, 0, 0, 0)};
static const struct step p_done[] = {S(0, 1, 0, 1500), S(0, 0, 0, 0)};

static const struct step *const patterns[] = {
	[HW_BOOT] = p_boot,   [HW_CLINK] = p_clink,         [HW_OK] = p_ok,     [HW_LOW_BATT] = p_low,
	[HW_NOT_READY] = p_not_ready, [HW_BUZZ] = p_buzz, [HW_DONE] = p_done,
};

static const struct step *cur;
static void pattern_work_fn(struct k_work *w);
static K_WORK_DELAYABLE_DEFINE(pattern_work, pattern_work_fn);

static void apply(const struct step *s)
{
	gpio_pin_set_dt(&motor, s->motor);
	gpio_pin_set_dt(&led_green, s->green);
	gpio_pin_set_dt(&led_red, s->red);
}

static void pattern_work_fn(struct k_work *w)
{
	ARG_UNUSED(w);
	if (!cur) {
		return;
	}
	apply(cur);
	if (cur->ms == 0) {
		cur = NULL;
		return;
	}
	k_work_reschedule(&pattern_work, K_MSEC(cur->ms));
	cur++;
}

void hw_signal(enum hw_pattern p)
{
	if (p >= ARRAY_SIZE(patterns)) {
		return;
	}
	cur = patterns[p];
	k_work_reschedule(&pattern_work, K_NO_WAIT);
}

/* ---------- Taste und Ladekontakte ---------- */

static void touch_debounced(struct k_work *w)
{
	ARG_UNUSED(w);
	if (gpio_pin_get_dt(&touch) == 1 && touch_cb) {
		touch_cb();
	}
}
static K_WORK_DELAYABLE_DEFINE(touch_work, touch_debounced);

static void usb_debounced(struct k_work *w)
{
	ARG_UNUSED(w);
	if (usb_cb) {
		usb_cb(hw_usb_present());
	}
}
static K_WORK_DELAYABLE_DEFINE(usb_work, usb_debounced);

static void touch_isr(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
	k_work_reschedule(&touch_work, K_MSEC(40));
}

static void usb_isr(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
	k_work_reschedule(&usb_work, K_MSEC(300));
}

bool hw_usb_present(void)
{
	return gpio_pin_get_dt(&usb) == 1;
}

/* ---------- Akku ---------- */

int hw_battery_mv(void)
{
	int16_t raw = 0;
	struct adc_sequence seq = {
		.buffer = &raw,
		.buffer_size = sizeof(raw),
	};
	int err = adc_sequence_init_dt(&batt, &seq);

	if (!err) {
		err = adc_read_dt(&batt, &seq);
	}
	if (err) {
		LOG_WRN("Akku lesen fehlgeschlagen: %d", err);
		return -1;
	}
	int32_t mv = raw;

	adc_raw_to_millivolts_dt(&batt, &mv);
	return (int)mv * 2; /* Spannungsteiler 2,2 MΩ / 2,2 MΩ */
}

uint8_t hw_battery_pct(int mv)
{
	if (mv <= BATT_MIN_MV) {
		return 0;
	}
	if (mv >= BATT_MAX_MV) {
		return 100;
	}
	return (uint8_t)((mv - BATT_MIN_MV) * 100 / (BATT_MAX_MV - BATT_MIN_MV));
}

/* ---------- Start ---------- */

int hw_init(void (*on_touch)(void), void (*on_usb)(bool present))
{
	const struct gpio_dt_spec *outs[] = {&led_green, &led_red, &motor};

	touch_cb = on_touch;
	usb_cb = on_usb;

	for (size_t i = 0; i < ARRAY_SIZE(outs); i++) {
		if (!gpio_is_ready_dt(outs[i]) || gpio_pin_configure_dt(outs[i], GPIO_OUTPUT_INACTIVE)) {
			return -ENODEV;
		}
	}

	if (gpio_pin_configure_dt(&touch, GPIO_INPUT) ||
	    gpio_pin_interrupt_configure_dt(&touch, GPIO_INT_EDGE_TO_ACTIVE)) {
		return -ENODEV;
	}
	gpio_init_callback(&touch_gpio_cb, touch_isr, BIT(touch.pin));
	gpio_add_callback_dt(&touch, &touch_gpio_cb);

	if (gpio_pin_configure_dt(&usb, GPIO_INPUT) ||
	    gpio_pin_interrupt_configure_dt(&usb, GPIO_INT_EDGE_BOTH)) {
		return -ENODEV;
	}
	gpio_init_callback(&usb_gpio_cb, usb_isr, BIT(usb.pin));
	gpio_add_callback_dt(&usb, &usb_gpio_cb);

	if (!adc_is_ready_dt(&batt) || adc_channel_setup_dt(&batt)) {
		return -ENODEV;
	}
	return 0;
}
