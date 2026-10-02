// Run the existing host-side suites in separate processes, without a shell.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const env = { ...process.env };
// Python suites also invoke Node. Use the same installation as this runner.
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
env[pathKey] = path.dirname(process.execPath) + path.delimiter + (env[pathKey] || '');
// Ignore Python environment settings (especially PYTHONOPTIMIZE, which removes
// assertions), use UTF-8 on Windows too, and leave no bytecode in the checkout.
const pythonFlags = ['-E', '-X', 'utf8', '-B'];

function findPython() {
  const candidates = process.env.PYTHON
    ? [[process.env.PYTHON]]
    : process.platform === 'win32'
      ? [['py', '-3'], ['python'], ['python3']]
      : [['python3'], ['python']];
  const probe = 'import sys; print(sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 8) else 1)';
  for (const [command, ...args] of candidates) {
    const result = spawnSync(command, [...args, ...pythonFlags, '-c', probe], {
      cwd: root, env, encoding: 'utf8', timeout: 5000, windowsHide: true,
    });
    if (!result.error && result.status === 0) {
      console.log(`Python ${result.stdout.trim()} (${command}${args.length ? ' ' + args.join(' ') : ''})`);
      return [command, ...args, ...pythonFlags];
    }
  }
  throw new Error('Python 3.8+ is required. Install it or set PYTHON to a Python executable path (no arguments). '
    + `Tried: ${candidates.map(parts => parts.join(' ')).join(', ')}. No Python tests were run.`);
}

function main() {
  const args = process.argv.slice(2);
  const suite = args[0] || 'all';
  if (args.length > 1 || !['all', 'js', 'python'].includes(suite)) {
    throw new Error('Usage: node scripts/run-tests.js [all|js|python]');
  }
  const files = fs.readdirSync(path.join(root, 'tests'), { withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => entry.name).sort();
  const groups = [
    { name: 'JavaScript', enabled: suite !== 'python', files: files.filter(name => name.endsWith('.js')), command: [process.execPath] },
    { name: 'Python', enabled: suite !== 'js', files: files.filter(name => name.endsWith('_runtime.py')) },
  ].filter(group => group.enabled);
  for (const group of groups) {
    if (!group.files.length) throw new Error(`No ${group.name} tests found in tests/.`);
  }
  const python = groups.find(group => group.name === 'Python');
  if (python) python.command = findPython();
  console.log(`Running ${groups.map(group => `${group.files.length} ${group.name}`).join(' + ')} test files.`);

  let passed = 0;
  const failed = [];
  for (const group of groups) {
    const [command, ...commandArgs] = group.command;
    for (const file of group.files) {
      const relative = `tests/${file}`;
      console.log(`\n[RUN] ${relative}`);
      const result = spawnSync(command, [...commandArgs, relative], {
        cwd: root, env, stdio: 'inherit', windowsHide: true,
      });
      if (result.error || result.status !== 0) {
        failed.push(relative);
        console.error(`[FAIL] ${relative}: ${result.error ? result.error.message : result.signal ? `signal ${result.signal}` : `exit ${result.status}`}`);
        if (result.signal === 'SIGINT') {
          process.exitCode = 130;
          return;
        }
      } else {
        passed++;
        console.log(`[PASS] ${relative}`);
      }
    }
  }
  console.log(`\nTest files: ${passed} passed, ${failed.length} failed, ${passed + failed.length} total.`);
  if (failed.length) console.error(`Failed: ${failed.join(', ')}`);
  process.exitCode = failed.length ? 1 : 0;
}

try {
  main();
} catch (error) {
  console.error(`Test runner: ${error.message}`);
  process.exitCode = 1;
}
