"""Syntax and pure-function execution only; no device access."""
import contextlib
import io
import json
import subprocess
import sys
import types

sources = json.loads(subprocess.check_output(['node', 'tests/python_blocks.js', '--json']).decode('utf-8'))
sys.modules['machine'] = types.SimpleNamespace(Pin=object)
expected = ['6', '10', 'None', 'None', '1.7320508075688772', '日本語', '0\n1\n2\n3', '4', '']
assert len(sources) == len(expected)
for source, result in zip(sources, expected):
    compile(source, '<python-block>', 'exec')
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exec(source, {})
    assert output.getvalue().strip() == result, output.getvalue()
print('PASS: handwritten Python blocks compile and return expected values; nested indentation and imports work')
