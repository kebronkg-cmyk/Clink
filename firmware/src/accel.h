/* Stoßerkennung mit dem LIS3DH (Click-Interrupt im Sensor, Chip schläft dazwischen). */
#ifndef CLINK_ACCEL_H
#define CLINK_ACCEL_H

#include <stdbool.h>
#include <stdint.h>

int accel_init(void (*on_shock)(int64_t uptime_ms));
int accel_set_threshold(uint16_t shock_mg);
void accel_enable(bool on);

#endif
