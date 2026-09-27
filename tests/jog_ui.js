const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Blockly = require('blockly');
const {JSDOM} = require('jsdom');
const app = fs.readFileSync('app.js', 'utf8');
const I18n = require('../i18n.js');
const Servo = require('../servo.js');
const Wiring = require('../wiring.js');
const workspace = new Blockly.Workspace();
const context = vm.createContext({Blockly, workspace, PicoI18n:I18n, ServoBlocks:Servo,
  PicoJog:require('../jog.js'), BasicBlocks:require('../basic.js'), GeekDisplay:require('../display.js'),
  localStorage:{getItem:()=> 'pico2w'}, encoder:new TextEncoder(), showToast:()=>{}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'), app.indexOf('  const elements')), context);
vm.runInContext(app.slice(app.indexOf('  const theme'), app.indexOf('  const workspace')), context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'), app.indexOf('  function validateProgram')), context);
const types = {uart_scs_bind:500, xl330_bind:20, sts3215_bind:500, sts3235_bind:500};
for (const [type, speed] of Object.entries(types)) {
  workspace.clear();
  const b = workspace.newBlock(type);
  assert.equal(b.getFieldValue('SPEED'), speed, type);
  assert.equal(b.getField('SPEED').isVisible(), false, type);
  assert.equal(b.getInput('JOG_SPEED_INTERNAL').isVisible(), false, type);
  assert.ok(b.getField('CENTER').isVisible());
  assert.ok(b.getField('STEP').isVisible());
  b.setFieldValue(37, 'SPEED');
  const state = Blockly.serialization.workspaces.save(workspace);
  for (const lang of ['en','ja']) {
    I18n.setLanguage(lang);
    const warn = console.warn; console.warn = ()=>{};
    try { vm.runInContext('registerBlocks()', context); } finally { console.warn = warn; }
    Blockly.serialization.workspaces.load(state, workspace);
    const restored = workspace.getAllBlocks(false)[0];
    assert.equal(restored.getFieldValue('SPEED'), 37, 'preserve old custom speed');
    assert.equal(restored.getField('SPEED').isVisible(), false);
    const duplicate = Blockly.serialization.blocks.append(Blockly.serialization.blocks.save(restored), workspace);
    assert.equal(duplicate.getFieldValue('SPEED'),37);
    assert.equal(duplicate.getField('SPEED').isVisible(),false);
    duplicate.dispose();
    for(const transport of ['uart_controller_setup','wifi_jog_setup']) {
      const setup = workspace.newBlock(transport);
      const axis = vm.runInContext('getJogAxes().Y', context);
      assert.equal(axis.speed,37, transport+' uses stored speed');
      setup.dispose();
    }
  }
}
for (const type of ['scs009_move','xl330_move','sts3215_move','sts3235_move']) {
  assert.ok(workspace.newBlock(type).getField('SPEED').isVisible(), 'explicit movement stays editable');
}
assert.equal(workspace.newBlock('pwm_bind').getField('SPEED'),null);
for(const model of ['scs009','sts3215','sts3235','xl330']) assert.ok(Wiring.signalNote(model));
assert.equal(Wiring.signalNote('pwm'),'');
assert.match(Wiring.signalNote('sts3235'),/直結動作実績/);
assert.match(Wiring.signalNote('xl330'),/公式3.3 V/);
const document = new JSDOM(fs.readFileSync('index.html','utf8')).window.document;
assert.ok([...document.querySelectorAll('.controller-lead')].every(p=>!p.textContent.includes('速度値 500')));
assert.match(document.querySelector('#signalLevelHelp').textContent,/2〜5 V/);
assert.match(document.querySelector('#signalLevelHelp').textContent,/電圧変換ではありません/);
assert.equal(document.querySelectorAll('#signalLevelHelp a').length,5);
assert.match(document.querySelector('#atomPullupGuide').textContent,/追加前にDATAが3.3 V/);
workspace.dispose();
console.log('PASS: hidden JOG speeds/defaults, legacy import, duplication, language changes, USB/Wi-Fi parity and signal-level guidance');
