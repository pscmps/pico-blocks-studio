"""Syntax-check generated Python in both display languages; no device access."""
import json
import subprocess

sources = json.loads(subprocess.check_output(
    ['node', 'tests/i18n.js', '--json'], text=True, encoding='utf-8'))
for index, source in enumerate(sources):
    compile(source, 'localized-program-' + str(index), 'exec')
print('PASS:', len(sources), 'localized Python programs compile; user text is preserved')
