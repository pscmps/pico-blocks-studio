try:
    from machine import Pin, PWM
except ImportError:
    Pin = PWM = None


class Pen:
    def __init__(self, pin, frequency=50, up_us=1000, down_us=1800):
        self.up_us, self.down_us = int(up_us), int(down_us)
        self.pwm = PWM(Pin(pin)) if PWM else None
        if self.pwm:
            self.pwm.freq(frequency)
        self.up()

    def _set_us(self, value):
        if not self.pwm:
            return
        if hasattr(self.pwm, "duty_ns"):
            self.pwm.duty_ns(int(value) * 1000)
        else:
            self.pwm.duty_u16(int(value * 65535 / 20000))

    def up(self):
        self._set_us(self.up_us)

    def down(self):
        self._set_us(self.down_us)
