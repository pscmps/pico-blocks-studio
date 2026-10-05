const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'picoblocks runner fixture '));
try {
  fs.mkdirSync(path.join(fixture, 'scripts'));
  fs.mkdirSync(path.join(fixture, 'tests'));
  const runner = path.join(fixture, 'scripts', 'run-tests.js');
  fs.copyFileSync(path.join(__dirname, 'run-tests.js'), runner);
  // Resolve an installed interpreter for the fixtures, including Windows' launcher.
  const candidates = process.argv[2] || process.env.PYTHON
    ? [[process.argv[2] || process.env.PYTHON]]
    : process.platform === 'win32' ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']];
  let python;
  for (const [command, ...args] of candidates) {
    const probe = spawnSync(command, [...args, '-E', '-c', 'import sys; print(sys.executable)'], {
      encoding: 'utf8', timeout: 5000, windowsHide: true,
    });
    if (!probe.error && probe.status === 0) { python = probe.stdout.trim(); break; }
  }
  assert.ok(python, 'Python is required to verify the runner');
  const write = (file, text) => fs.writeFileSync(path.join(fixture, 'tests', file), text);
  const jsPass = "require('node:assert/strict').equal(process.cwd(), require('node:path').resolve(__dirname, '..')); console.log('JS_RAN');";
  const pyPass = "import pathlib, subprocess, sys\nassert pathlib.Path.cwd() == pathlib.Path(__file__).resolve().parents[1]\nassert sys.flags.optimize == 0\nassert sys.flags.utf8_mode == 1\nassert subprocess.check_output(['node', '-p', '1 + 1']).strip() == b'2'\nprint('PYTHON_RAN')\n";
  write('a.js', jsPass);
  write('z.js', jsPass);
  write('a_runtime.py', pyPass);
  write('z_runtime.py', pyPass);
  function run(args = [], extraEnv = {}) {
    const env = { ...process.env, PYTHON: python, ...extraEnv };
    const result = spawnSync(process.execPath, [runner, ...args], { cwd: __dirname, env, encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  }
  function check(name, body) {
    body();
    console.log(`PASS: ${name}`);
  }
  check('all suites, separate processes, UTF-8, Node subprocess, foreign cwd and spaces in checkout path', () => {
    const result = run();
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /4 passed, 0 failed, 4 total/);
  });
  check('a failed JavaScript file returns 1 and does not prevent later JS/Python tests', () => {
    write('a.js', 'process.exit(7);');
    const result = run();
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /3 passed, 1 failed, 4 total/);
    assert.match(result.output, /Failed: tests\/a.js/);
    assert.match(result.output, /PYTHON_RAN/);
    write('a.js', jsPass);
  });
  check('Python assertion failure remains fatal with PYTHONOPTIMIZE=2; later files still run', () => {
    write('a_runtime.py', "assert False, 'intentional failure'\n");
    const result = run([], { PYTHONOPTIMIZE: '2' });
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /3 passed, 1 failed, 4 total/);
    assert.match(result.output, /AssertionError: intentional failure/);
    assert.match(result.output, /\[PASS\] tests\/z_runtime.py/);
    assert.match(result.output, /Failed: tests\/a_runtime.py/);
    write('a_runtime.py', pyPass);
  });
  check('invalid explicit Python path fails before executing any test and never falls back', () => {
    const result = run([], { PYTHON: path.join(fixture, 'missing-python.exe') });
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Python 3\.8\+ is required/);
    assert.doesNotMatch(result.output, /\[RUN\]/);
  });
  check('JS-only suite does not require Python', () => {
    const result = run(['js'], { PYTHON: path.join(fixture, 'missing-python.exe') });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /2 passed, 0 failed, 2 total/);
    assert.doesNotMatch(result.output, /PYTHON_RAN/);
  });
  check('Python-only suite runs both Python files', () => {
    const result = run(['python']);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /2 passed, 0 failed, 2 total/);
    assert.doesNotMatch(result.output, /JS_RAN/);
  });
  check('invalid and extra arguments fail', () => {
    for (const args of [['typo'], ['js', 'ignored']]) {
      const result = run(args);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /Usage:/);
    }
  });
  check('new JS test files are discovered automatically', () => {
    write('new.js', jsPass);
    const result = run();
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /5 passed, 0 failed, 5 total/);
  });
  check('automatic Python detection works without an override', () => {
    const result = run([], { PYTHON: '' });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /5 passed, 0 failed, 5 total/);
  });
  check('Python executable path with spaces is passed without a shell', () => {
    const venv = path.join(fixture, 'python environment');
    const created = spawnSync(python, ['-m', 'venv', '--without-pip', venv], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(created.error);
    assert.equal(created.status, 0, created.stdout + created.stderr);
    const venvPython = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const result = run([], { PYTHON: venvPython });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /5 passed, 0 failed, 5 total/);
  });
  check('empty Python suite fails instead of silently passing', () => {
    fs.unlinkSync(path.join(fixture, 'tests', 'a_runtime.py'));
    fs.unlinkSync(path.join(fixture, 'tests', 'z_runtime.py'));
    const result = run();
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /No Python tests found/);
  });
  console.log('11 runner integration checks passed.');
} finally {
  // Only remove this process's unique temporary fixture, never the checkout.
  fs.rmSync(fixture, { recursive: true, force: true });
}
