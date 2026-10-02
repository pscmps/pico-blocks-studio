"""Compare source protocol/planner with generated blocks; fake hardware only."""
import contextlib
import io
import json
from pathlib import Path
import random
import re
import subprocess
import sys
import types

data = json.loads(subprocess.check_output(['node', 'tests/gcode.js', '--json']).decode('utf-8'))
fixture = Path(__file__).parent / 'fixtures' / 'plotterflow'
original = {}
exec((fixture / 'gcode.py').read_text(encoding='utf-8'), original)
exec((fixture / 'planner.py').read_text(encoding='utf-8'), original)
exec((fixture / 'protocol.py').read_text(encoding='utf-8').replace('from gcode import parse_words, ModalState', ''), original)

class Pin:
    OUT = 1
    instances = {}
    def __new__(cls, pin, *args, **kwargs):
        if pin not in cls.instances:
            cls.instances[pin] = super().__new__(cls)
        return cls.instances[pin]
    def __init__(self, pin, mode=None, value=None):
        self.id = pin
        if value is not None:
            self.current = value
    def value(self, v=None):
        if v is not None:
            self.current = v
        return self.current

class PWM:
    def __init__(self, pin): self.pin = pin; self.closed = False
    def freq(self, value): self.frequency = value
    def duty_ns(self, value): self.pulse = value
    def deinit(self): self.closed = True

class StateMachine:
    def __init__(self, number, program, **kwargs):
        self.number = number; self.init(program, **kwargs); self.events = []; self.flushed = 0
    def init(self, program, **kwargs): self.config = kwargs; self.flushed = getattr(self, 'flushed', 0) + 1
    def active(self, state): self.running = state
    def put(self, mask): self.events.append(mask)
    def tx_fifo(self): return 0

pio_options = []
def asm_pio(**kwargs):
    pio_options.append(kwargs)
    return lambda function: function
sys.modules['machine'] = types.SimpleNamespace(Pin=Pin, PWM=PWM)
sys.modules['rp2'] = types.SimpleNamespace(asm_pio=asm_pio, PIO=types.SimpleNamespace(OUT_LOW=0, SHIFT_RIGHT=1), StateMachine=StateMachine)
real_time = __import__('time')
sys.modules['time'] = types.SimpleNamespace(sleep_us=lambda _:None)
actual = {}
exec(compile(data['runtime'], '<gcode-runtime>', 'exec'), actual)
assert pio_options[0]['set_init'] == (0, 0)

# Only documented MicroPython regex methods, not findall/sub/groups/end.
class LimitedRegex:
    def __init__(self, pattern): self.compiled = re.compile(pattern)
    def search(self, text): return self.compiled.search(text)
actual['WORD_RE'] = LimitedRegex(r'([A-Z])\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?)')
actual['re'] = types.SimpleNamespace(match=re.match)
lines = ['', '; test', '(test)', 'g01 x1.5y-2 F300 ; skip', 'G1 X.25 X2E-1', 'G 90',
         'G1 (x22) Y5', 'G1 (unterminated X3', 'M3 S500', 'G92 X1 Y2 Z0', 'T0', 'G1 (semi;inside) X2']
random.seed(42)
lines += ['%s X%.3fY%.3f F%d' % (random.choice(['G0','G1','G92']), random.uniform(-5,5),random.uniform(-5,5),random.randint(1,1000)) for _ in range(1000)]
for line in lines:
    assert actual['parse_words'](line) == original['parse_words'](line), line
for _ in range(1000):
    coords = [random.randint(-30,30) for _ in range(4)]
    assert list(actual['line_events'](*coords)) == original['line_events'](*coords), coords

class Stepper:
    def __init__(self): self.enabled=False; self.events=[]; self.direction=None; self.stopped=False
    def set_enabled(self, value): self.enabled=value
    def set_directions(self, *direction): self.direction=direction
    def queue(self, events): self.events.extend(events)
    def stop(self): self.events.clear(); self.stopped=True
class Pen:
    def __init__(self): self.state='up'
    def up(self): self.state='up'
    def down(self): self.state='down'

old = original['Controller'](original['CartesianPlanner'](80,80),Stepper(),Pen())
new = actual['Controller'](actual['CartesianPlanner'](80,80),Stepper(),Pen())
commands=['M115','G1 X1','M17','G90','G21','G1 X1 Y.5 F300','G1 Z0','M5','M3','G91','G1 X-.2 Y.3','G20','G1 X.01 F20','G92 X0 Y0 Z1','G21','G90','G0 X-.1 Y0 Z1','G2 X2','\x85','M18','G1 X1']
for line in commands:
    assert new.execute(line) == old.execute(line), line
    assert vars(new.modal) == vars(old.modal), line
    assert vars(new.planner) == vars(old.planner), line
    assert vars(new.stepper) == vars(old.stepper), line
    assert new.pen.state == old.pen.state

# Real adapter logic under stubs: both EN polarities, FIFO reset and cleanup.
for active_low in (True,False):
    driver=actual['StepperPIO'](2,3,4,5,7,active_low)
    assert driver.enable_pin.value()==int(active_low)
    driver.set_enabled(True);assert driver.enable_pin.value()==int(not active_low)
    driver.queue([(3,1),(1,1)]);assert driver.sm.events==[3,1]
    driver.stop();assert driver.sm.flushed==1
    driver.close();assert driver.sm.running==0 and driver.enable_pin.value()==int(active_low)
    assert Pin(2).value()==0 and Pin(3).value()==0
actual['_pf_controller']=new
assert actual['_pf_reply']('\x85\n')=='ok'  # STOP must survive whitespace stripping.
class Broken:
    def execute(self, line): raise ValueError('test_error')
actual['_pf_controller']=Broken()
assert actual['_pf_reply']('M17')=='error:test_error'

# Execute the full generated sample, including visible receive/if/print blocks.
class EndOfTest(BaseException): pass
class Input:
    def __init__(self): self.lines=iter(['M115\n','G1 X1\n','M17\n','G1 X.1 Y.1 Z0 F300\n','M18\n'])
    def readline(self):
        try: return next(self.lines)
        except StopIteration: raise EndOfTest()
stdin=sys.stdin
try:
    for sample in data['programs']:
        sys.stdin=Input();out=io.StringIO();scope={}
        with contextlib.redirect_stdout(out):
            try: exec(compile(sample['code'],'<generated-sample>','exec'),scope)
            except EndOfTest: pass
        result=out.getvalue().splitlines()
        assert result[0]=='PlotterFlow MicroPython RP ready; board='+sample['board']+'-stepdir',result
        assert result[1]==old.execute('M115')
        assert result[2:]==['error:motors_disabled','ok','ok','ok'],result
        assert scope['_pf_stepper'].sm.events==[3]*8
        assert not scope['_pf_stepper'].enabled and scope['_pf_pen'].pwm.closed
finally:
    sys.stdin=stdin;sys.modules['time']=real_time
print('PASS: 1012 parser cases, 1000 XY paths, source command/state/mask parity, EN/FIFO/cleanup and all generated receiver loops (stub hardware)')
