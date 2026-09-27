/* Device-side Python; never executed by the browser. */
globalThis.PlotterFlowRuntime = String.raw`
# PlotterFlow MicroPython RP compatibility blocks
# Based on pscmps/plotterflow-micropython-rp @ 0e4917ee24309520e9e147308ff75fe1d22e56f1
# See GCODE.md for intentional portability/safety changes and prototype limits.
"""Small, allocation-light G-code parser for the PlotterFlow line protocol."""

import re

WORD_RE = re.compile(r"([A-Z])\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?)")


def parse_words(line):
    # Avoid optional re.sub / findall APIs on MicroPython.
    clean = ""
    i = 0
    while i < len(line):
        if line[i] == ";":
            break
        if line[i] == "(":
            end = line.find(")", i + 1)
            if end >= 0:
                i = end + 1
                continue
        clean += line[i]
        i += 1
    clean = clean.strip().upper()
    if not clean:
        return "", {}
    words = {}
    remaining = clean
    while remaining:
        word = WORD_RE.search(remaining)
        if not word:
            break
        words[word.group(1)] = float(word.group(2))
        value = word.group(0)
        remaining = remaining[remaining.find(value) + len(value):]
    command = ""
    match = re.match(r"([GMT])\s*(\d+)", clean)
    if match:
        command = match.group(1) + str(int(match.group(2)))
    return command, words


class ModalState:
    def __init__(self):
        self.absolute = True
        self.mm = True
        self.x = 0.0
        self.y = 0.0
        self.z = 1.0
        self.feed = 500.0
        self.enabled = False
        self.pen_down = False

    def motion(self, words):
        target = [self.x, self.y, self.z]
        for index, axis in enumerate(("X", "Y", "Z")):
            if axis not in words:
                continue
            value = words[axis] * (25.4 if not self.mm else 1.0)
            target[index] = value if self.absolute else target[index] + value
        if "F" in words:
            self.feed = max(1.0, words["F"] * (25.4 if not self.mm else 1.0))
        self.x, self.y, self.z = target
        return tuple(target)


"""Cartesian XY Bresenham planner."""


def line_events(x0, y0, x1, y1):
    """Return synchronized (step_mask, tick_hint) events for integer steps."""
    dx = abs(int(x1) - int(x0))
    dy = abs(int(y1) - int(y0))
    sx = 1 if x1 >= x0 else -1
    sy = 1 if y1 >= y0 else -1
    err = dx - dy
    x, y = int(x0), int(y0)
    while True:
        if x == int(x1) and y == int(y1):
            break
        e2 = 2 * err
        mask = 0
        if e2 > -dy:
            err -= dy
            x += sx
            mask |= 1
        if e2 < dx:
            err += dx
            y += sy
            mask |= 2
        yield (mask, 1)


class CartesianPlanner:
    def __init__(self, sx_per_mm, sy_per_mm):
        self.sx_per_mm = float(sx_per_mm)
        self.sy_per_mm = float(sy_per_mm)
        self.x_steps = 0
        self.y_steps = 0

    def plan(self, x_mm, y_mm):
        target_x = round(float(x_mm) * self.sx_per_mm)
        target_y = round(float(y_mm) * self.sy_per_mm)
        direction = (target_x >= self.x_steps, target_y >= self.y_steps)
        events = line_events(self.x_steps, self.y_steps, target_x, target_y)
        self.x_steps, self.y_steps = target_x, target_y
        return events, direction

    def zero(self, x_mm=0.0, y_mm=0.0):
        self.x_steps = round(float(x_mm) * self.sx_per_mm)
        self.y_steps = round(float(y_mm) * self.sy_per_mm)
"""Line-oriented PlotterFlow protocol and controller."""




class Controller:
    def __init__(self, planner, stepper, pen):
        self.modal = ModalState()
        self.planner = planner
        self.stepper = stepper
        self.pen = pen
        self.stop_requested = False

    def execute(self, line):
        if line and line[0] == "\x85":
            self.stop_requested = True
            self.stepper.stop()
            return "ok"
        command, words = parse_words(line)
        if not command:
            return "ok"
        if command == "G0" or command == "G1":
            if not self.modal.enabled:
                return "error:motors_disabled"
            target = self.modal.motion(words)
            events, direction = self.planner.plan(target[0], target[1])
            self.stepper.set_directions(*direction)
            self.stepper.queue(events)
            if "Z" in words:
                (self.pen.down if target[2] <= 0 else self.pen.up)()
            return "ok"
        if command == "G90":
            self.modal.absolute = True
        elif command == "G91":
            self.modal.absolute = False
        elif command == "G20":
            self.modal.mm = False
        elif command == "G21":
            self.modal.mm = True
        elif command == "G92":
            self.modal.x = words.get("X", self.modal.x)
            self.modal.y = words.get("Y", self.modal.y)
            self.modal.z = words.get("Z", self.modal.z)
            self.planner.zero(self.modal.x, self.modal.y)
        elif command == "M17":
            self.stepper.set_enabled(True)
            self.modal.enabled = True
        elif command == "M18":
            self.stepper.stop()
            self.stepper.set_enabled(False)
            self.modal.enabled = False
        elif command == "M3":
            self.pen.down()
            self.modal.pen_down = True
        elif command == "M5":
            self.pen.up()
            self.modal.pen_down = False
        elif command == "M115":
            return "PlotterFlow MicroPython RP;caps=G0,G1,G90,G91,G20,G21,G92,M17,M18,M3,M5,STOP"
        else:
            return "error:unsupported"
        return "ok"



import sys
import time
import rp2
from machine import Pin, PWM

# Explicit two-pin SET mask; 1 MHz compatibility clock, not feed control.
@rp2.asm_pio(out_init=(rp2.PIO.OUT_LOW, rp2.PIO.OUT_LOW),
             set_init=(rp2.PIO.OUT_LOW, rp2.PIO.OUT_LOW),
             out_shiftdir=rp2.PIO.SHIFT_RIGHT)
def _step_program():
    pull(block)
    out(pins, 2)
    set(pins, 0)

class StepperPIO:
    def __init__(self, x_step, y_step, x_dir, y_dir, enable, enable_active_low=True):
        if y_step != x_step + 1:
            raise ValueError("PIO step pins must be consecutive")
        self.enabled = False
        self.active_low = bool(enable_active_low)
        self.x_step, self.y_step = x_step, y_step
        self.x_dir_pin = Pin(x_dir, Pin.OUT, value=0)
        self.y_dir_pin = Pin(y_dir, Pin.OUT, value=0)
        self.enable_pin = Pin(enable, Pin.OUT, value=int(self.active_low))
        self.sm = rp2.StateMachine(0, _step_program, freq=1_000_000,
                                   out_base=Pin(x_step), set_base=Pin(x_step))
        self.sm.active(1)

    def set_directions(self, x_positive, y_positive):
        self.x_dir_pin.value(int(bool(x_positive)))
        self.y_dir_pin.value(int(bool(y_positive)))

    def set_enabled(self, enabled):
        self.enabled = bool(enabled)
        self.enable_pin.value(int(not enabled if self.active_low else bool(enabled)))

    def queue(self, events):
        if not self.enabled:
            raise RuntimeError("motors disabled")
        for mask, _tick_hint in events:
            self.sm.put(mask)
        # Finish the previous pulses before another command changes DIR.
        while self.sm.tx_fifo():
            time.sleep_us(1)
        time.sleep_us(10)

    def stop(self):
        self.sm.active(0)
        # init flushes FIFOs; restart alone does not.
        self.sm.init(_step_program, freq=1_000_000,
                     out_base=Pin(self.x_step), set_base=Pin(self.x_step))
        self.sm.active(1)

    def close(self):
        self.set_enabled(False)
        self.sm.active(0)
        Pin(self.x_step, Pin.OUT, value=0)
        Pin(self.y_step, Pin.OUT, value=0)

class Pen:
    def __init__(self, pin, frequency=50, up_us=1000, down_us=1800):
        self.up_us, self.down_us = int(up_us), int(down_us)
        self.frequency = int(frequency)
        self.pwm = PWM(Pin(pin))
        self.pwm.freq(self.frequency)
        self.up()

    def _set_us(self, value):
        if hasattr(self.pwm, "duty_ns"):
            self.pwm.duty_ns(int(value) * 1000)
        else:
            self.pwm.duty_u16(int(value * self.frequency * 65535 / 1000000))

    def up(self):
        self._set_us(self.up_us)

    def down(self):
        self._set_us(self.down_us)

    def close(self):
        self.pwm.deinit()

_pf_planner = _pf_stepper = _pf_pen = _pf_controller = None

def _pf_readline():
    return sys.stdin.readline()

def _pf_reply(line):
    try:
        # Keep STOP intact: CPython's generic strip treats U+0085 as whitespace.
        return _pf_controller.execute(str(line).strip(" \t\r\n"))
    except Exception as exc:
        return "error:%s" % exc

def _pf_parse_dict(line):
    command, words = parse_words(str(line))
    return {"command": command, "words": words}
`;
if(typeof module!=='undefined')module.exports=globalThis.PlotterFlowRuntime;
