"""Exercise emitted ESP32 Python using deterministic peripherals, no hardware."""
import json
import subprocess
import sys
import types

sys.dont_write_bytecode = True
data = json.loads(subprocess.check_output(['node', 'tests/atom.js', '--json'], encoding='utf-8'))
for code in data['sources'] + [data['gate'], data['install'], data['adc']]:
    compile(code, '<atom generated>', 'exec')

events, ticks = [], [0]
clock = types.ModuleType('time')
def tick():
    ticks[0] += 1
    return ticks[0]
clock.ticks_ms, clock.ticks_add, clock.ticks_diff = tick, lambda a,b:a+b, lambda a,b:a-b
clock.sleep_ms = lambda ms: (events.append(('sleep',ms)), ticks.__setitem__(0,ticks[0]+ms))
class Pin:
    IN, OPEN_DRAIN, PULL_UP = 0, 1, 2
    pressed = False
    def __init__(self, pin, *args, **kwargs):
        self.pin = pin
        events.append(('pin',pin,args,kwargs))
    def init(self, *args): events.append(('release',self.pin,args))
    def value(self): return not self.pressed
class UART:
    reply, broken, mismatch, silent = b'', False, False, False
    def __init__(self, uart_id, **kwargs):
        assert uart_id in (1,2)
        assert kwargs['tx'] == kwargs['rx']
        assert events[-1][0] == 'pin' and events[-1][2] == (Pin.OPEN_DRAIN,Pin.PULL_UP)
        assert events[-1][3] == {'value':1}
        events.append(('uart',uart_id,kwargs))
        self.rx = b''
    def read(self, count):
        part,self.rx = self.rx[:min(count,3)],self.rx[min(count,3):]
        return part or None
    def write(self, packet):
        events.append(('send',packet))
        self.rx = b'' if self.silent else (b'bad!' if self.mismatch else bytes(packet)) + self.reply
        return len(packet)-1 if self.broken else len(packet)
    def flush(self): events.append(('flush',))
    def deinit(self): events.append(('deinit',))
machine=types.ModuleType('machine'); machine.Pin, machine.UART = Pin, UART
sys.modules['machine'],sys.modules['time'] = machine,clock
scope={'Pin':Pin,'time':clock}
exec(data['bus'],scope)
Bus=scope['ServoBus']
packet=b'\xff\xff\x01\x02\x01\xfb'
status=b'\xff\xff\x01\x02\x00\xfc'
UART.reply=status
bus=Bus(26,1000000,1)
assert bus.exchange(packet,1) == status  # not its own TX echo
assert bus.exchange(packet,1) == status
assert not any(e[0]=='release' for e in events)
UART.reply=b'\xff\xff\xfd\x00\x01\x04\x00\x55\x00\xaa\xbb'
assert bus.exchange(b'test',2) == UART.reply
UART.reply=status
assert bus.exchange(packet,0) is None
assert ('sleep',20) in events
for mode in ['broken','mismatch','silent','no_response','bad_length']:
    UART.reply=b'' if mode=='no_response' else b'\xff\xff\x01\xff' if mode=='bad_length' else status
    UART.broken,UART.mismatch,UART.silent = mode=='broken',mode=='mismatch',mode=='silent'
    bus=Bus(32,57600,2)
    try: bus.exchange(packet,1)
    except (ValueError,OSError): pass
    else: raise AssertionError(mode)
    assert bus.uart is None and events[-1] == ('release',32,(Pin.IN,Pin.PULL_UP))
    try: bus.exchange(packet,1)
    except OSError: pass
    else: raise AssertionError('closed bus was reused')
UART.broken=UART.mismatch=UART.silent=False
for uart_id in [0,3]:
    try: Bus(26,1000000,uart_id)
    except ValueError: pass
    else: raise AssertionError('UART0 must stay reserved')

UART.reply=b''
exec(data['scs'],scope)
scs=scope['SCS009UART'](26,1000000)
scs.move(1,512)
sent=[e[1] for e in events if e[0]=='send'][-1]
assert sent[:6] == b'\xff\xff\x01\x09\x03\x2a'
assert sent[6:8] == b'\x00\x02' and sent[-1] == (~sum(sent[2:-1])) & 255

class Pixel:
    def __init__(self, pin, n): assert pin.pin==27 and n==1
    def __setitem__(self,index,value): events.append(('pixel',value))
    def write(self): pass
sys.modules['neopixel']=types.SimpleNamespace(NeoPixel=Pixel)
exec(data['led'],scope)
scope['led'].value(1); scope['led'].toggle()
assert [e[1] for e in events if e[0]=='pixel'] == [(0,0,0),(16,16,16),(0,0,0)]

receiver=[]
sys.modules['_picoblocks_wifi']=types.SimpleNamespace(serve=lambda:receiver.append('wifi'))
for pressed in [False,True]:
    Pin.pressed=pressed; app_events=[]; messages=[]
    exec(data['gate'],{'events':app_events,'print':messages.append})
    assert app_events == ([] if pressed else ['app'])
    assert ('PICOBLOCKS_MODE WRITE' if pressed else 'PICOBLOCKS_MODE RUN') in messages
assert receiver==['wifi']
assert any(e[:2]==('pin',39) and e[2]==(Pin.IN,) for e in events)
print('PASS: ESP32 generated Python, open-drain/mux order, fragmented echo/status, timeouts/invalid lengths, fail-closed cleanup, SCS packet, RGB LED, front-button run/write gate')
