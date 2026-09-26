"""GEEK LCD host-side SPI/framebuffer checks; no board is connected."""
import json
import subprocess
import sys
import types

driver = subprocess.check_output(['node', '-e', "process.stdout.write(require('./display.js').DRIVER)"], text=True, encoding='utf-8')
pins, traffic = {}, []
class Pin:
    OUT = 1
    def __init__(self, n, mode=None, value=None):
        self.n = n
        if mode is not None:
            pins[n] = dict(mode=mode, value=value)
    def value(self, value=None):
        if value is not None:
            pins[self.n]['value'] = value
        return pins[self.n]['value']

class SPI:
    def __init__(self, n, **kw):
        assert n == 1 and kw['sck'].n == 10 and kw['mosi'].n == 11
        assert kw['baudrate'] == 24000000 and kw['polarity'] == kw['phase'] == 0
        pins[8] = dict(mode='SPI-MISO', value=0)
        self.fail = False
    def write(self, data):
        assert pins[8]['mode'] == Pin.OUT, 'SPI must not steal LCD DC'
        assert pins[9]['value'] == 0
        if self.fail:
            raise OSError('simulated SPI failure')
        traffic.append((pins[8]['value'], bytes(data)))

class FrameBuffer:
    def __init__(self, data, width, height, mode):
        assert len(data) == 120 and width == 120 and height == 8
        self.characters = ''
    def fill(self, colour):
        assert colour == 0
        self.characters = ''
    def text(self, text, x, y, colour):
        assert x == y == 0 and colour == 1
        self.characters = text
    def pixel(self, x, y):
        # Deterministic asymmetric test glyph, not a substitute display font.
        return x == 0 and y == 1 and bool(self.characters)

sys.modules['machine'] = types.SimpleNamespace(SPI=SPI)
sys.modules['framebuf'] = types.SimpleNamespace(FrameBuffer=FrameBuffer, MONO_HLSB=1)
env = dict(Pin=Pin, time=types.SimpleNamespace(sleep_ms=lambda ms:None))
exec(driver, env)
assert env['_lcd'] is None and not traffic  # unused driver has no hardware effects
lcd = env['_get_lcd']()
assert env['_get_lcd']() is lcd
assert pins[25]['value'] == 1
assert traffic[:6] == [(0,b'\x01'),(0,b'\x11'),(0,b'\x3a'),(1,b'\x55'),(0,b'\x36'),(1,b'\x70')]
assert (1,b'\x00\x28\x01\x17') in traffic  # 40..279, 240 pixels
assert (1,b'\x00\x35\x00\xbb') in traffic  # 53..187, 135 pixels
assert sum(len(data) for dc,data in traffic if len(data)==480) == 240*135*2
traffic.clear()
lcd.line(8, 'A')
assert (1,b'\x00\xa5\x00\xb4') in traffic  # bottom text row: y112..127
rows=[data for dc,data in traffic if len(data)==480]
assert len(rows)==16
assert rows[2][:4] == b'\xff'*4 and rows[3] == rows[2]  # 2x both axes
assert not any(rows[0]) and not any(rows[2][4:])
lcd.line(1,'1234567890123456789')
assert lcd.lines[0]=='123456789012345'
lcd.line(1,2)
assert lcd.lines[0]=='2' and lcd.glyph.characters=='2'
for row in (0,9):
    try: lcd.line(row,'bad')
    except ValueError: pass
    else: raise AssertionError('invalid row accepted')
lcd.clear()
lcd.println('1234567890123456\nOK')
assert lcd.lines[:3] == ['123456789012345','6','OK']
lcd.clear()
for i in range(10): lcd.println(i)
assert lcd.lines == [str(i) for i in range(2,10)]
assert lcd.clean('abc\r\n日本語\t!') == 'abc\n???    !'
lcd.clear()
assert lcd.cursor==0 and lcd.lines==['']*8
events=[]
env['print'] = lambda value:events.append(('serial',value))
lcd.println = lambda value:events.append(('lcd',value))
env['_lcd_serial_print']('off')
assert events==[('serial','off')]
env['_lcd_mirror']=True
env['_lcd_serial_print'](123)
assert events[-2:]==[('serial',123),('lcd',123)]
lcd.spi.fail=True
for action in (lambda:lcd.command(0x29),lambda:lcd.line(1,'X'),lcd.clear):
    try: action()
    except OSError: pass
    else: raise AssertionError('SPI failure was swallowed')
    assert pins[9]['value']==1
programs=json.loads(subprocess.check_output(['node','tests/basics.js','--json'], text=True, encoding='utf-8'))
for source in programs['sources']: compile(source,'<generated>','exec')
print('PASS: GEEK LCD init, SPI/DC ownership, window offsets, 2x pixels, clipping, scroll, mirror, cleanup and generated Python')
