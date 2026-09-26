"""Exercise generated firmware with fake RP networking and fragmented USB input."""
import io
import json
import subprocess
import sys
import types
import socket as real_socket
import time as real_time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = subprocess.check_output([
    'node', '-e', "const j=require('./jog.js');process.stdout.write(j.runtime(j.defaults(true),{ssid:'Pico-test',password:'testpassword'}))"
], cwd=root).decode('utf-8')
compile(source, '<generated JOG>', 'exec')

class Input:
    text = ''
    def read(self, size):
        result, self.text = self.text[:size], self.text[size:]
        return result

stdin = Input()
class Poll:
    def register(self, *args): pass
    def poll(self, timeout): return [1] if stdin.text else []

class Socket:
    closed = False
    def setsockopt(self, *args): pass
    def bind(self, *args): pass
    def listen(self, *args): pass
    def setblocking(self, *args): pass
    def accept(self): raise OSError(11)
    def close(self): self.closed = True

class WLAN:
    SEC_WPA_WPA2 = 0x400006
    enabled = False
    def __init__(self, interface): pass
    def active(self, value=None):
        if value is not None: self.enabled = value
        return self.enabled
    def config(self, **kwargs): assert kwargs['security'] == self.SEC_WPA_WPA2
    def ifconfig(self): return ('192.168.4.1', '', '', '')

sys.modules['network'] = types.SimpleNamespace(WLAN=WLAN, AP_IF=1)
sys.modules['socket'] = types.SimpleNamespace(socket=Socket, SOL_SOCKET=1, SO_REUSEADDR=2)
moves = []
env = dict(sys=types.SimpleNamespace(stdin=stdin), json=json,
           select=types.SimpleNamespace(poll=Poll, POLLIN=1),
           time=types.SimpleNamespace(ticks_ms=lambda: 0, ticks_add=lambda a,b:a+b, ticks_diff=lambda a,b:a-b, sleep_ms=lambda n:None),
           scs009=types.SimpleNamespace(move=lambda *args:moves.append(args)))
exec(source, env)
for axis, servo_id in [('Y', 1), ('X', 2), ('Z', 3), ('R', 4)]:
    env['_jog_delta'](axis, 1)
    assert moves[-1] == (servo_id, 521, 0, 500)
env['_apply_controller_value']('Y', 1020)
env['_jog_delta']('Y', 1)
assert env['controller_values']['Y'] == 1023
env['_jog_center']()
assert set(env['controller_values'].values()) == {511}
stdin.text = 'DELTA R '
env['_controller_usb_poll']()
assert env['controller_values']['R'] == 511
stdin.text = '-1\n'
env['_controller_usb_poll']()
assert env['controller_values']['R'] == 501
stdin.text = 'x' * 100 + '\nDELTA R 1\n'
while stdin.text: env['_controller_usb_poll']()
assert env['controller_values']['R'] == 511

def request(method, path, origin='http://192.168.4.1'):
    raw = f'{method} {path} HTTP/1.1\r\nHost: 192.168.4.1\r\nOrigin: {origin}\r\n\r\n'.encode()
    return env['_wifi_route'](raw)

assert b'200 OK' in request('GET', '/')
assert b'KeyW' in request('GET', '/')
assert b'200 OK' in request('POST', '/jog/Y/1')
assert env['controller_values']['Y'] == 521
assert b'403 Forbidden' in request('POST', '/jog/Y/1', 'https://other.example')
assert env['controller_values']['Y'] == 521
assert b'405 Method' in request('GET', '/jog/Y/1')
assert b'400 Bad Request' in request('POST', '/jog/Y/99')
assert b'400 Bad Request' in request('POST', '/jog/NOPE/1')
assert b'200 OK' in request('POST', '/center')
assert set(env['controller_values'].values()) == {511}
old_server = env['_wifi_server']
# New targets share the same USB/HTTP routing with their own position ranges.
env['_jog_config']['Y'] = dict(id=3, target='xl330', center=2048, step=10, speed=20, min=0, max=4095)
env['xl330'] = types.SimpleNamespace(move=lambda *args:moves.append(('xl330',) + args))
env['_apply_controller_value']('Y', 9999)
assert moves[-1] == ('xl330', 3, 4095, 20)
env['_jog_config']['X'] = dict(id=5, target='sts3235', center=2048, step=10, speed=500, min=0, max=4095)
env['sts3235'] = types.SimpleNamespace(move=lambda *args:moves.append(('sts3235',) + args))
env['_apply_controller_value']('X', 2000)
assert moves[-1] == ('sts3235', 5, 2000, 500)
assert b'200 OK' in request('POST', '/jog/X/1')
assert moves[-1] == ('sts3235', 5, 2010, 500)
env['_jog_config']['R'] = dict(id=2, target='pwm', center=90, step=2, speed=0, min=0, max=180)
env['pwm_servos'] = {2:types.SimpleNamespace(angle=lambda value:moves.append(('pwm', value)))}
env['_apply_controller_value']('R', -10)
assert moves[-1] == ('pwm', 0)
assert b'200 OK' in request('POST', '/jog/R/1')
assert moves[-1] == ('pwm', 2)
def unavailable(*args): raise OSError('test timeout')
env['xl330'].move = unavailable
assert b'503 Service' in request('POST', '/jog/Y/-1')
assert env['controller_values']['Y'] == 4095  # Never report a failed command as accepted.
exec(source, env)
assert old_server.closed
print('PASS: 4-axis mapping, limits, USB fragmentation, HTTP commands, origins, restart')

if '--serve' in sys.argv:
    # Run the actual generated HTTP handler on localhost for browser QA.
    sys.modules['socket'] = real_socket
    env['time'] = types.SimpleNamespace(ticks_ms=lambda:int(real_time.monotonic()*1000), ticks_add=lambda a,b:a+b,
                                      ticks_diff=lambda a,b:a-b, sleep_ms=lambda ms:real_time.sleep(ms/1000))
    exec(source.replace("('0.0.0.0', 80)", "('127.0.0.1', 4175)"), env)
    print('Preview: http://127.0.0.1:4175/', flush=True)
    try:
        while True:
            env['_controller_poll']()
            real_time.sleep(.005)
    finally:
        env['_wifi_server'].close()
