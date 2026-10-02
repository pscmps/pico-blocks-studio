"""Exercise generated code with simulated hardware; not a hardware certification."""
import ast
import json
import subprocess
import sys
import types

data = json.loads(subprocess.check_output(['node', 'tests/advanced.js', '--json'], text=True, encoding='utf-8'))
for index, source in enumerate(data['sources']):
    compile(source, f'advanced_{index}.py', 'exec')

class Pin:
    IN, OUT, PULL_UP, PULL_DOWN, IRQ_FALLING, IRQ_RISING = range(6)
    pins = {}
    def __init__(self, pin, *args, value=0):
        self.pin, self.level, self.handler = pin, value, None
        Pin.pins[pin] = self
    def value(self, value=None):
        if value is not None:
            self.level = value
        return self.level
    def irq(self, handler=None, **kwargs):
        self.handler = handler

class SoftI2C:
    writes = []
    def __init__(self, **kwargs):
        assert kwargs['scl'].pin == 0 and kwargs['sda'].pin == 1
    def scan(self):
        return [64]
    def writeto_mem(self, address, register, value):
        self.writes.append((address, register, value))
    def readfrom_mem(self, address, register, size):
        return bytes(range(size))

class SoftSPI:
    MSB = 0
    fail = False
    def __init__(self, **kwargs):
        assert kwargs['sck'].pin == 2 and kwargs['mosi'].pin == 3 and kwargs['miso'].pin == 4
    def write_readinto(self, tx, rx):
        assert Pin.pins[5].level == 0
        if self.fail:
            raise OSError('mock bus failure')
        rx[:] = bytes(v ^ 0xff for v in tx)

class PWM:
    instances = []
    def __init__(self, pin, freq, duty_u16):
        self.pin, self.frequency, self.duty, self.closed = pin.pin, freq, duty_u16, False
        self.instances.append(self)
    def freq(self, frequency):
        self.frequency = frequency
    def duty_u16(self, duty):
        self.duty = duty
    def deinit(self):
        self.closed = True

machine = types.ModuleType('machine')
machine.Pin, machine.SoftI2C, machine.SoftSPI, machine.PWM = Pin, SoftI2C, SoftSPI, PWM
machine.disable_irq = lambda: 0
machine.enable_irq = lambda state: None
sys.modules['machine'] = machine

output = []
exec(data['dataProgram'], {'print': output.append})
assert output[:16] == [9, 4, 4, True, 14, 14, 14, 1, ['a', 'b'], 'aXc', 42, 3, 14, 'caught', 'finally', [2, 3]], output
assert list(output[16]) == [9, 2, 3]
assert output[17:] == [bytes([9, 2, 3]), ['value']]

output = []
hw = {'print': output.append}
exec(data['hardwareProgram'], hw)
assert output == [[64], bytes([0, 1, 2]), bytearray([254, 253, 252])]
assert SoftI2C.writes == [(64, 2, bytes([1, 2, 3]))]
assert Pin.pins[5].level == 1
assert PWM.instances[-1].closed and PWM.instances[-1].duty == 0
assert Pin.pins[6].level == 0
SoftSPI.fail = True
try:
    hw['_adv_spi_transfer'](1, [1])
    raise AssertionError('Expected SPI failure')
except OSError:
    pass
assert Pin.pins[5].level == 1, 'CS must be released after failure'
try:
    hw['_adv_set_pwm'](6, 1000, 65536)
    raise AssertionError('Expected duty bound failure')
except ValueError:
    pass

# Execute full generated IRQ/timer program, then interrupt it as USB Stop would.
clock = types.ModuleType('time')
clock.absolute = 0
clock.ticks_ms = lambda: clock.absolute % 1024
clock.ticks_add = lambda start, delta: (start + delta) % 1024
clock.ticks_diff = lambda end, start: (end - start + 512) % 1024 - 512
def sleep(ms):
    clock.absolute += ms
    if clock.absolute in (1, 2, 4, 12) and Pin.pins[0].handler:
        Pin.pins[0].handler(Pin.pins[0])
    if clock.absolute >= 20:
        raise KeyboardInterrupt()
clock.sleep_ms = sleep
sys.modules['time'] = clock
scope = {}
try:
    # String exec can leave CPython's unhandled-interrupt flag set even when
    # KeyboardInterrupt is caught below. A code object keeps this mock local.
    exec(compile(data['eventProgram'], '<generated IRQ/timer>', 'exec'), scope)
except KeyboardInterrupt:
    pass
def user(name):
    return 'user_' + '_'.join(format(ord(c), 'x') for c in name)
assert scope[user('edges')] == 2, scope[user('edges')]
assert scope[user('ticks')] == 3, scope[user('ticks')]
assert not scope['_adv_irq_pins'] and not scope['_adv_timers']
assert Pin.pins[0].handler is None

# Helpers/definitions before the main try, for isolated wrap/reentrancy tests.
tree = ast.parse(data['eventProgram'])
assert isinstance(tree.body[-1], ast.Try)
helpers = compile(ast.Module(body=tree.body[:-1], type_ignores=[]), 'helpers', 'exec')
scope = {}
exec(helpers, scope)
hits = []
clock.absolute = 1020
scope['_adv_timers'][1] = [clock.ticks_add(clock.ticks_ms(), 5), 5, lambda: hits.append('once'), False]
scope['_adv_poll']()
assert hits == []
clock.absolute = 1025
scope['_adv_poll']()
assert hits == ['once'] and not scope['_adv_timers'], 'one shot across wrap'
scope['_adv_timers'][2] = [clock.ticks_ms(), 5, lambda: hits.append('repeat'), True]
scope['_adv_poll']()
clock.absolute += 40
scope['_adv_poll']()
assert hits.count('repeat') == 2, 'missed intervals are coalesced, not replayed'
scope['_adv_timers'].clear()
def nested():
    hits.append('nested')
    scope['_adv_poll']()
scope['_adv_timers'][1] = [clock.ticks_ms(), 5, nested, True]
scope['_adv_poll']()
assert hits.count('nested') == 1, 'callback must not re-enter dispatch'
def fail():
    raise ValueError('callback error')
scope['_adv_timers'][1] = [clock.ticks_ms(), 5, fail, False]
try:
    scope['_adv_poll']()
    raise AssertionError('Expected callback failure')
except ValueError:
    pass
assert scope['_adv_polling'] is False

# JOG is polled by the same dispatcher rather than by an unreachable second loop.
tree = ast.parse(data['eventJogProgram'])
jog_helpers = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.Assign)) and
               ((isinstance(n, ast.FunctionDef) and n.name.startswith('_adv_')) or
                (isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id.startswith('_adv_') for t in n.targets)))]
jog_hits = []
scope = {'time':clock,'machine':machine,'_controller_poll':lambda:jog_hits.append(1),
         '_adv_events':{},'_adv_timers':{},'_adv_irq_pins':{}}
exec(compile(ast.Module(body=jog_helpers,type_ignores=[]),'jog_dispatch','exec'),scope)
scope['_adv_poll']()
assert jog_hits == [1]
print(f"PASS: {len(data['sources'])} generated programs compile; collections/functions, SPI cleanup, I2C, PWM limits, deferred IRQ, debounce, timer wrap/coalescing, JOG dispatch and Stop cleanup")
