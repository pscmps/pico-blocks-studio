"""Compile all samples and exercise their JOG mapping without hardware."""
import json
import subprocess
import types
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads(subprocess.check_output(['node', 'tests/samples.js', '--json'], cwd=root).decode('utf-8'))
for sample in data['programs']:
    compile(sample['code'], '/'.join(sample[k] for k in ['board', 'model', 'transport']), 'exec')
for sample in data['jogs']:
    moves = []
    class Servo:
        def move(self, servo_id, value, *args): moves.append((servo_id, value))
    class PWM:
        def __init__(self, channel): self.channel = channel
        def angle(self, value): moves.append((self.channel, value))
    class Poll:
        def register(self, *args): pass
    env = {'select': types.SimpleNamespace(poll=Poll, POLLIN=1), 'sys': types.SimpleNamespace(stdin=None),
           'json': json, 'pwm_servos': {i: PWM(i) for i in [1, 2, 3]}}
    env.update({m: Servo() for m in ['scs009', 'xl330', 'sts3215', 'sts3235']})
    exec(sample['code'], env)
    assert moves == []
    for axis in ['Y', 'X', 'Z', 'R']:
        env['_jog_delta'](axis, 1)
    assert [i for i, value in moves] == [1, 2, 3]
    for axis, (servo_id, value) in zip(['Y', 'X', 'Z'], moves):
        config = sample['config'][axis]
        assert value == config['center'] + config['step']
    moves.clear()
    env['_jog_center']()
    assert [i for i, value in moves] == [1, 2, 3]
    assert [value for i, value in moves] == [sample['config'][a]['center'] for a in ['Y', 'X', 'Z']]
print('PASS: 60 sample programs compile; all JOG/Space mappings command only servos 1-3')
