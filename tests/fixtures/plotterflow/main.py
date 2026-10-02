"""USB CDC entry point for the first MicroPython STEP/DIR profile."""

import sys
import board_config as config
from planner import CartesianPlanner
from pio_stepper import StepperPIO
from pen import Pen
from protocol import Controller


planner = CartesianPlanner(config.STEPS_PER_MM_X, config.STEPS_PER_MM_Y)
stepper = StepperPIO(config.X_STEP, config.Y_STEP, config.X_DIR, config.Y_DIR, config.ENABLE, config.ENABLE_ACTIVE_LOW)
pen = Pen(config.PEN_PWM, config.PEN_PWM_FREQ, config.PEN_UP_US, config.PEN_DOWN_US)
controller = Controller(planner, stepper, pen)

print("PlotterFlow MicroPython RP ready; board=%s" % config.BOARD)
while True:
    line = sys.stdin.readline()
    if not line:
        continue
    try:
        print(controller.execute(line.strip()))
    except Exception as exc:
        print("error:%s" % exc)
