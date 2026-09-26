"""Host-side protocol/PWM tests. No hardware is accessed."""
import json
import subprocess
import sys
import types
from pathlib import Path

root = Path(__file__).resolve().parents[1]
drivers = json.loads(subprocess.check_output(['node', '-e', "const s=require('./servo.js'); console.log(JSON.stringify([s.BUS_DRIVER,s.XL330_DRIVER,s.STS_DRIVER,s.PWM_DRIVER]))"], cwd=root))

class Pin:
    IN, OUT, PULL_UP = 0, 1, 2
    def __init__(self, *args, **kwargs): pass

class PWM:
    def __init__(self, pin, **kwargs): self.duty = kwargs['duty_u16']
    def duty_ns(self, value): self.duty = value
    def duty_u16(self, value): self.duty = value

sys.modules['machine'] = types.SimpleNamespace(Pin=Pin, PWM=PWM)
pio = types.SimpleNamespace(IN_HIGH=1, SHIFT_RIGHT=0, JOIN_RX=1)
sys.modules['rp2'] = types.SimpleNamespace(PIO=pio, asm_pio=lambda **kw:lambda f:f)
env = dict(Pin=Pin)
for driver in drivers:
    compile(driver, '<generated driver>', 'exec')
    exec(driver, env)

XL, STS, PWMServo = (env[k] for k in ['XL330', 'STS3215', 'PWMServo'])
# Reference vector in the previous C implementation / ROBOTIS Protocol 2.0.
assert XL.packet(1, 1).hex() == 'fffffd0001030001194e'
assert STS.packet(1, 1).hex() == 'ffff010201fb'
assert STS.packet(1, 3, bytes([40, 1])).hex() == 'ffff0104032801ce'

class ReplyBus:
    response = b''
    def exchange(self, packet, protocol):
        self.packet, self.protocol = packet, protocol
        return self.response

bus = ReplyBus()
xl, sts = XL(bus), STS(bus)
bus.response = XL.packet(1, 0x55, bytes([0, 0xa6, 4, 42]))
assert xl.ping(1) == dict(model=1190, firmware=42)
# Stuffing/un-stuffing, including adjacent marker sequences.
payload = bytes.fromhex('fffffdfdfffffdfffffd')
bus.response = XL.packet(1, 0x55, b'\x00' + payload)
assert xl.request(1, 2) == payload
bus.response = XL.packet(1, 0x55, b'\x00' + bytes.fromhex('ffffffff'))
assert xl.position(1) == -1

def fails(kind, action):
    try: action()
    except kind: return
    raise AssertionError('Expected ' + kind.__name__)

bus.response = bytearray(bus.response)
bus.response[-1] ^= 1
fails(ValueError, lambda:xl.position(1))
bus.response = XL.packet(2, 0x55, b'\x00')
fails(ValueError, lambda:xl.request(1, 1))
bus.response = XL.packet(1, 0x55, b'\x04')
fails(OSError, lambda:xl.request(1, 1))

bus.response = STS.packet(1, 0, b'\x0a\x80')
assert sts.position(1) == -10
bus.response = STS.packet(1, 0)
assert sts.ping(1)
bus.response = STS.packet(1, 4)
fails(OSError, lambda:sts.ping(1))
bus.response = bytearray(STS.packet(1, 0)); bus.response[-1] ^= 1
fails(ValueError, lambda:sts.ping(1))

for driver, mode in [(xl, 3), (sts, 0)]:
    writes = []
    driver.write = lambda *args:writes.append(args)
    driver.read = lambda sid, addr, size: ({11:b'\x03', 10:b'\x00', 132:b'\x00\x08\x00\x00'}.get(addr, b'\x00') if driver is xl else {33:b'\x00', 18:b'\x00', 11:b'\xff\x0f', 56:b'\x00\x08'}.get(addr, b'\x00'))
    driver.move(1, 2048, 20, 10)
    assert writes[-1][1:] == ((108, bytes.fromhex('0a0000001400000000080000')) if driver is xl else (41, bytes.fromhex('0a000800001400')))
    fails(ValueError, lambda:driver.move(1, -1))
    fails(ValueError, lambda:driver.move(1, 4096))
    fails(ValueError, lambda:driver.move(1, 2048, 0))
    writes.clear()
    driver.torque(1, True)
    assert writes[-1][1:] == (64 if driver is xl else 40, b'\x01')
    assert len(writes) == 2  # Set present position goal BEFORE torque on.
    driver.read = lambda sid, addr, size:b'\x04' * size
    fails(ValueError, lambda:driver.check_mode(1))
    driver.torque(1, False)  # Torque off must work in any mode.
    assert writes[-1][2] == b'\x00'

pwm = PWMServo(2)
assert pwm.pwm.duty == 0  # No motion on creation.
for degrees, ns in [(0, 1000000), (90, 1500000), (180, 2000000)]:
    pwm.angle(degrees); assert pwm.pwm.duty == ns
fails(ValueError, lambda:pwm.angle(181))
fails(ValueError, lambda:pwm.pulse(2500))
fails(ValueError, lambda:PWMServo(2, 2000, 1000))
pwm.stop(); assert pwm.pwm.duty == 0
pwm.angle(90); assert pwm.pwm.duty == 1500000

if '--pio-assembler' in sys.argv:
    # Optional official rp2.py, downloaded from the pinned MicroPython release.
    assembler_path = Path(sys.argv[sys.argv.index('--pio-assembler') + 1])
    pio.SHIFT_LEFT = 1
    pio.JOIN_NONE = 0
    sys.modules['_rp2'] = types.SimpleNamespace(PIO=pio)
    sys.modules['micropython'] = types.SimpleNamespace(const=lambda x:x)
    rp2 = types.ModuleType('rp2')
    exec(assembler_path.read_text(encoding='utf-8'), rp2.__dict__)
    sys.modules['rp2'] = rp2
    assembled = dict(Pin=Pin)
    exec(drivers[0], assembled)
    tx, rx = assembled['_servo_tx'], assembled['_servo_rx']
    assert len(tx[0]) + len(rx[0]) + 9 <= 32  # Existing SCS TX also fits.
    assert tx[0][-1] == 0xc014  # IRQ relative(4): flags4/6 for SM0/2.
    assert rx[0][0] == 0x20d7  # Wait IRQ relative(7): flags4/6 for SM1/3.
    rp2.asm_pio_encode('irq(clear, rel(4))', 0)
    print('PASS: official MicroPython PIO assembly, instruction budget and relative RX gate')

programs = json.loads(subprocess.check_output(['node', 'tests/generation.js', '--json'], cwd=root))
for index, program in enumerate(programs):
    compile(program, '<generated program %d>' % index, 'exec')
print('PASS: XL330 CRC/stuffing, STS checksum, status errors, position ranges, mode guards, PWM limits, %d complete programs' % len(programs))
