cmake_minimum_required(VERSION 3.20.0)

# Board-Definition des CLINK-Armbands (KKM W59) liegt in boards/
list(APPEND BOARD_ROOT ${CMAKE_CURRENT_SOURCE_DIR})

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(clink_firmware)

target_sources(app PRIVATE
  src/main.c
  src/hw.c
  src/store.c
  src/accel.c
  src/radio.c
  src/gatt.c
  src/clink_logic.c
)
