"""Compile generated programs, then exercise a hardware-free basic block program."""
import json
import subprocess
import sys
import types

data = json.loads(subprocess.check_output(['node', 'tests/basics.js', '--json'], text=True, encoding='utf-8'))
for index, source in enumerate(data['sources']):
    compile(source, f'basic_{index}.py', 'exec')

class Pin:
    IN, OUT, PULL_UP, PULL_DOWN = range(4)
    writes = []
    def __init__(self, number, *args, **kwargs):
        self.number = number
    def value(self, value=None):
        if value is not None:
            self.writes.append((self.number, value))
        return 1

class ADC:
    def __init__(self, pin):
        self.pin = pin
    def read_u16(self):
        return 65535

machine = types.ModuleType('machine')
machine.Pin, machine.ADC = Pin, ADC
sys.modules['machine'] = machine
clock = types.ModuleType('time')
waits = []
clock.sleep_ms = waits.append
sys.modules['time'] = clock
output = []
exec(data['runtimeScenario'], {'print': lambda value: output.append(str(value))})
assert output == ['value=6', '3.3', '180'], output
assert Pin.writes == [(0, 1)]
assert waits == [10]
print(f"PASS: {len(data['sources'])} Python programs compile; ADC, variables, loop, condition, math, clamp, GPIO and wait execute correctly")
