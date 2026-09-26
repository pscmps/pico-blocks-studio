// Test the actual app generator, without a browser or hardware.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const app = fs.readFileSync('app.js', 'utf8');
const context = vm.createContext({
  ServoBlocks: require('../servo.js'), PicoJog: require('../jog.js'),
  localStorage: {getItem: () => 'pico'},
  encoder: new TextEncoder(), showToast: () => {},
});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'), app.indexOf('  const elements')), context);
vm.runInContext(app.slice(app.indexOf('  function pyString'), app.indexOf('  const PICO_LEFT_PINS')), context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'), app.indexOf('  function validateProgram')), context);
vm.runInContext(app.slice(app.indexOf('  function validateProgram'), app.indexOf('  function getUartControllerConfig')), context);
function block(type, fields = {}, next = null) {
  return {type, getFieldValue:name => String(fields[name] ?? ''), getNextBlock:() => next, getInputTargetBlock:() => null};
}
const sources = [];
function generate(blocks) {
  const start = block('program_start', {}, blocks[0]);
  for (let i=0; i<blocks.length-1; i++) blocks[i].getNextBlock = () => blocks[i+1];
  context.workspace = {getTopBlocks:()=>[start], getAllBlocks:()=>[start,...blocks]};
  const code = vm.runInContext('generatePython()', context);
  sources.push(code);
  return code;
}
for (const board of ['pico','picow','pico2','pico2w','rp2040_geek','rp2350_geek','xiao_rp2040','xiao_rp2350']) {
  vm.runInContext(`selectedBoard='${board}'`, context);
  const config = vm.runInContext('BOARD_PROFILES[selectedBoard]', context);
  if (board.startsWith('xiao')) {
    assert.equal(config.pins.length, 11);
    assert.equal(config.pins[3], board === 'xiao_rp2040' ? 29 : 5);
    assert.ok(config.firmwareUrl.includes('SEEED_XIAO_'));
    assert.ok(!config.wifi);
  }
  generate([block('pwm_setup',{PIN:config.pins[0],CHANNEL:1,MIN_US:1000,MAX_US:2000}),block('pwm_move',{CHANNEL:1,ANGLE:90})]);
  for (const model of ['xl330','sts3215']) {
    const code = generate([block(model+'_setup',{PIN:config.pins[0],BAUD:57600}),block(model+'_ping',{ID:1}),block(model+'_move',{ID:1,POSITION:2048,SPEED:20,ACCEL:10}),block(model+'_bind',{ID:1,AXIS:'Y',CENTER:2048,STEP:10,SPEED:20}),block('uart_controller_setup')]);
    assert.ok(code.includes(`${model}.move(1, 2048, 20, 10)`));
    assert.ok(code.includes('"max":4095'));
    assert.ok(code.includes('ServoBus('+config.pins[0]+', 57600, 0)'));
  }
}
const two = generate([block('xl330_setup',{PIN:0,BAUD:57600}),block('sts3215_setup',{PIN:1,BAUD:1000000})]);
assert.ok(two.includes('ServoBus(1, 1000000, 2)'));
const scs = generate([block('scs009_setup',{PIN:2,BAUD:1000000}),block('sts3215_setup',{PIN:1,BAUD:1000000})]);
assert.ok(scs.includes('ServoBus(1, 1000000, 2)'));
const pwmJog = generate([block('pwm_setup',{PIN:2,CHANNEL:2,MIN_US:1000,MAX_US:2000}),block('pwm_bind',{ID:2,AXIS:'R',CENTER:90,STEP:2}),block('uart_controller_setup')]);
assert.ok(pwmJog.includes('"max":180'));
vm.runInContext("selectedBoard='pico2w'", context);
generate([block('xl330_setup',{PIN:0,BAUD:57600}),block('xl330_bind',{ID:1,AXIS:'Y',CENTER:2048,STEP:10,SPEED:20}),block('wifi_jog_setup',{SSID:'test',PASSWORD:'testpassword'})]);
assert.ok(vm.runInContext('validateProgram()', context));
function valid(blocks) {
  context.workspace = {getAllBlocks: () => blocks};
  return vm.runInContext('validateProgram()', context);
}
assert.equal(valid([block('xl330_move',{ID:1})]), false);
assert.equal(valid([block('xl330_setup',{PIN:0}),block('sts3215_setup',{PIN:0})]), false);
assert.equal(valid([block('xl330_setup',{PIN:0}),block('sts3215_setup',{PIN:1})]), true);
assert.equal(valid([block('xl330_setup',{PIN:0}),block('sts3215_setup',{PIN:1}),block('scs009_setup',{PIN:2})]), false);
assert.equal(valid([block('pwm_move',{CHANNEL:2})]), false);
assert.equal(valid([block('pwm_setup',{PIN:0,CHANNEL:1,MIN_US:1000,MAX_US:2000}),block('pwm_setup',{PIN:16,CHANNEL:2,MIN_US:1000,MAX_US:2000})]), false);
assert.equal(valid([block('pwm_setup',{PIN:0,CHANNEL:1,MIN_US:2000,MAX_US:1000})]), false);
assert.equal(valid([block('pwm_setup',{PIN:0,CHANNEL:1,MIN_US:1000,MAX_US:2000}),block('gpio_write',{PIN:0})]), false);
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(sources));
else console.log('PASS: 8 boards, 28 generated programs, model-specific JOG, PIO allocation');
