"""Boot gate and atomic save tests without hardware."""
import io
import json
from pathlib import Path
import subprocess
import sys
import types

def node(script):
    return subprocess.check_output(['node', '-e', script], text=True, encoding='utf-8')

boot = node("process.stdout.write(require('./boot.js').wrap('events.append(\"app\")'))")
compile(boot, 'main.py', 'exec')

def run_boot(pressed=None, supported=True, broken=False, start=0):
    ticks = [start]
    time = types.ModuleType('time')
    period = 1 << 30
    time.ticks_ms = lambda: ticks[0] % period
    time.ticks_diff = lambda a, b: ((a - b + period // 2) % period) - period // 2
    time.sleep_ms = lambda ms: ticks.__setitem__(0, ticks[0] + ms)
    rp2 = types.ModuleType('rp2')
    def button():
        if broken:
            raise OSError('button read failed')
        return pressed is not None and ticks[0] - start >= pressed
    if supported:
        rp2.bootsel_button = button
    sys.modules['rp2'], sys.modules['time'] = rp2, time
    events, messages = [], []
    exec(boot, {'events': events, 'print': messages.append})
    return events, messages, ticks[0] - start

for start in [0, (1 << 30) - 1000]:
    events, messages, elapsed = run_boot(start=start)
    assert events == ['app'] and elapsed == 3000
    assert messages[-2:] == ['PICOBLOCKS_MODE RUN', 'PICOBLOCKS_FINISHED']
for pressed in [0, 20, 1500, 2980]:
    events, messages, elapsed = run_boot(pressed)
    assert not events and elapsed <= 3000
    assert messages[-1] == 'PICOBLOCKS_MODE WRITE'
assert run_boot(3000)[0] == ['app']  # Outside the acceptance window.
for kwargs in [{'supported': False}, {'broken': True}]:
    events, messages, _ = run_boot(**kwargs)
    assert not events and 'PICOBLOCKS_MODE WRITE' in messages
assert run_boot(0)[0] == [] and run_boot()[0] == ['app']  # Wait is not persistent.

# Optional receiver runs only in BOOT-selected write mode, never beside user code.
receiver_calls=[]
receiver=types.ModuleType('_picoblocks_wifi')
receiver.serve=lambda:receiver_calls.append('serve')
sys.modules['_picoblocks_wifi']=receiver
run_boot();assert receiver_calls==[]
run_boot(0);assert receiver_calls==['serve']
sys.modules.pop('_picoblocks_wifi')

# Use the real browser-side bytes encoder to exercise Unicode and quoting.
save = node("""
const fs=require('node:fs'), vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
vm.runInThisContext(app.slice(app.indexOf('  function bytesLiteral'),app.indexOf('  async function connect()')));
process.stdout.write(require('./boot.js').saveCommand('print(\"日本語\\\\引用\\\\n\")',bytesLiteral));
""")

def save_test(short_write=False, corrupt=False, rename_fail=False):
    files = {'main.py': b'old program'}
    class File(io.BytesIO):
        def __init__(self, path, mode):
            self.path, self.mode = path, mode
            super().__init__(files.get(path, b'') if mode == 'rb' else b'')
        def write(self, data):
            return super().write(data[:4] if short_write else data)
        def read(self):
            return b'corrupt' if corrupt else super().read()
        def close(self):
            if self.mode == 'wb':
                files[self.path] = self.getvalue()
            super().close()
    os = types.ModuleType('os')
    def rename(src, dst):
        if rename_fail:
            raise OSError('rename failed')
        files[dst] = files.pop(src)
    os.rename, os.sync = rename, lambda: None
    sys.modules['os'] = os
    messages = []
    try:
        exec(save, {'open': File, 'print': messages.append})
    except OSError:
        assert files['main.py'] == b'old program'
        assert 'PICOBLOCKS_SAVED' not in messages
    else:
        assert not (short_write or corrupt or rename_fail)
        assert '日本語' in files['main.py'].decode()
        assert b'PICOBLOCKS_BOOT_WINDOW' in files['main.py']
        assert messages == ['PICOBLOCKS_SAVED']

for args in [{}, {'short_write': True}, {'corrupt': True}, {'rename_fail': True}]:
    save_test(**args)

# Compile boot-wrapped real programs, including indented PIO decorators and Wi-Fi HTML.
for script in ['tests/generation.js', 'tests/basics.js']:
    result = json.loads(subprocess.check_output(['node', script, '--json'], text=True, encoding='utf-8'))
    sources = result if isinstance(result, list) else result['sources']
    wrapped_sources = json.loads(subprocess.check_output(['node', '-e', 'const fs=require("node:fs");process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(0,"utf8")).map(require("./boot.js").wrap)))'], input=json.dumps(sources), text=True, encoding='utf-8'))
    for wrapped in wrapped_sources:
        compile(wrapped, '<saved main.py>', 'exec')
print('PASS: 3s gate, BOOT override, tick wrap, unsupported firmware, next-boot run, safe save and 79 wrapped programs')
