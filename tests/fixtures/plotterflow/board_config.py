"""Board recipe. Copy/replace this file for another RP2040/RP2350 board."""

BOARD = "pico2-stepdir"
X_STEP = 2
X_DIR = 4
Y_STEP = 3
Y_DIR = 5
ENABLE = 7
PEN_PWM = 12

ENABLE_ACTIVE_LOW = True
STEPS_PER_MM_X = 80.0
STEPS_PER_MM_Y = 80.0
MAX_FEED_MM_MIN = 2400.0
PEN_UP_US = 1000
PEN_DOWN_US = 1800
PEN_PWM_FREQ = 50
