/* LEDs, Vibrationsmotor, Touch-Taste, Akku und Ladekontakte des W59. */
#ifndef CLINK_HW_H
#define CLINK_HW_H

#include <stdbool.h>
#include <stdint.h>

enum hw_pattern {
	HW_BOOT,       /* kurz grün + rot: Band ist gestartet */
	HW_CLINK,      /* zweimal vibrieren + grün: neue Begegnung */
	HW_OK,         /* grün blinken: alles in Ordnung (Touch) */
	HW_LOW_BATT,   /* rot blinken: Akku fast leer */
	HW_NOT_READY,  /* rot-grün im Wechsel: noch nicht eingerichtet */
	HW_BUZZ,       /* dreimal vibrieren + blinken: "dieses Band" beim Auslesen */
	HW_DONE,       /* langes grün: ausgelesen und gelöscht */
};

int hw_init(void (*on_touch)(void), void (*on_usb)(bool present));
void hw_signal(enum hw_pattern p);
bool hw_usb_present(void);
int hw_battery_mv(void);
uint8_t hw_battery_pct(int mv);

#endif
