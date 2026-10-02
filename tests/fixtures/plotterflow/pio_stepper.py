"""PIO adapter with a CPython simulation fallback.

The first hardware PoC uses one FIFO event per synchronized XY step. The
Python planner never toggles GPIO; it only queues masks. Exact acceleration,
underflow telemetry, and DMA batching remain follow-up work.
"""

try:
    import rp2
    from machine import Pin
except ImportError:  # host simulator
    rp2 = None
    Pin = None


if rp2:
    @rp2.asm_pio(out_init=(rp2.PIO.OUT_LOW, rp2.PIO.OUT_LOW), out_shiftdir=rp2.PIO.SHIFT_RIGHT)
    def _step_program():
        pull(block)
        out(pins, 2)
        set(pins, 0)


class StepperPIO:
    def __init__(self, x_step, y_step, x_dir, y_dir, enable, enable_active_low=True, sm_id=0):
        self.events = []
        self.enabled = False
        self.sm = None
        if rp2:
            if y_step != x_step + 1:
                raise ValueError("PIO step pins must be consecutive")
            self.x_dir_pin = Pin(x_dir, Pin.OUT, value=0)
            self.y_dir_pin = Pin(y_dir, Pin.OUT, value=0)
            self.enable_pin = Pin(enable, Pin.OUT, value=1 if enable_active_low else 0)
            self.sm = rp2.StateMachine(sm_id, _step_program, freq=1_000_000,
                                       out_base=Pin(x_step), set_base=Pin(x_step))
            self.sm.active(1)
        else:
            self.x_dir_pin = self.y_dir_pin = self.enable_pin = None

    def set_directions(self, x_positive, y_positive):
        if self.x_dir_pin:
            self.x_dir_pin.value(1 if x_positive else 0)
            self.y_dir_pin.value(1 if y_positive else 0)

    def set_enabled(self, enabled):
        self.enabled = bool(enabled)
        if self.enable_pin:
            self.enable_pin.value(0 if enabled else 1)

    def queue(self, events):
        if not self.enabled:
            raise RuntimeError("motors disabled")
        for mask, _tick_hint in events:
            self.events.append(mask)
            if self.sm:
                self.sm.put(mask)

    def stop(self):
        self.events.clear()
        if self.sm:
            self.sm.restart()
