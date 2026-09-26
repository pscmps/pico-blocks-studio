const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const W = require('../wiring.js');
const block = (type, fields = {}, id = type) => ({type, id, getFieldValue: name => fields[name] ?? null});
const draw = pin => ({board: '<rect class="board-body"/>', dataPoint: {x:50, y:42 + pin * 10}, groundPoint: {x:50,y:64}});
const svg = group => new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">${W.render(group, draw, p=>'GP'+p).content}</svg>`).window.document;
assert.deepEqual(W.groups([]), []);
assert.deepEqual(W.groups([block('scs009_move', {ID:1})]), []);
let groups = W.groups([block('pwm_setup',{CHANNEL:2,PIN:3}),block('pwm_setup',{CHANNEL:1,PIN:2})]);
assert.equal(groups.length,1);
assert.deepEqual(groups[0].devices.map(d=>d.id),[1,2]);
assert.equal(new Set(groups[0].devices.map(d=>d.colour)).size,2);
let dom = svg(groups[0]);
assert.equal(dom.querySelectorAll('[data-servo="pwm"]').length,2);
assert.equal(dom.querySelectorAll('[data-signal]').length,2);
assert.notEqual(dom.querySelector('[data-signal="1"]').getAttribute('stroke'),dom.querySelector('[data-signal="2"]').getAttribute('stroke'));
assert.ok(dom.body.textContent.includes('PWM 1 · GP2') && dom.body.textContent.includes('PWM 2 · GP3'));
for (const model of ['scs009','xl330','sts3215','sts3235']) {
  const setup = block(model+'_setup',{PIN:2});
  groups = W.groups([setup,block(model+'_move',{ID:3}),block(model+'_torque',{ID:1}),block(model+'_value',{ID:3})]);
  assert.deepEqual(groups[0].devices.map(d=>d.id),[1,3]);
  dom=svg(groups[0]);
  assert.equal(dom.querySelectorAll('[data-servo]').length,2);
  assert.equal(dom.querySelectorAll('[data-chain]').length,3); // DATA + V+ + GND
  assert.ok(!dom.querySelector('[data-signal]'));
  assert.equal(W.groups([setup])[0].devices[0].id,null);
  assert.deepEqual(W.groups([setup,block(model+'_move',{ID:0})])[0].devices.map(d=>d.id),[0]);
}
const Jog = require('../jog.js');
groups=W.groups([block('scs009_setup',{PIN:2})],Jog.defaults(true));
assert.deepEqual(groups[0].devices.map(d=>d.id),[1,2,3,4]);
const axes=Jog.defaults(true); axes.Y={id:2,target:'pwm'};
assert.deepEqual(W.groups([block('scs009_setup',{PIN:2})],axes)[0].devices.map(d=>d.id),[2,3,4]);
groups=W.groups([block('pwm_setup',{CHANNEL:1,PIN:2}),block('sts3235_setup',{PIN:3}),block('sts3235_bind',{ID:5})]);
assert.equal(groups.length,2);
assert.deepEqual(groups[1].devices.map(d=>d.id),[5]);
// Adding/removing another channel must not change the first channel's colour.
assert.equal(W.groups([block('pwm_setup',{CHANNEL:2,PIN:3})])[0].devices[0].colour, W.groups([block('pwm_setup',{CHANNEL:1,PIN:2}),block('pwm_setup',{CHANNEL:2,PIN:3})])[0].devices[1].colour);
console.log('PASS: PWM group/colour stability, serial ID deduplication/chain, ID0, JOG defaults, all servo models');

// Exercise the real board geometry + app renderer for every supported board.
const fs=require('node:fs'), vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const page=new JSDOM(fs.readFileSync('index.html','utf8')).window.document;
const $=selector=>page.querySelector(selector);
const context=vm.createContext({ServoWiring:W, document:page, $, localStorage:{getItem:()=> 'pico'},
  getUartControllerBlock:()=>null,
  elements:Object.fromEntries(['pinoutLink','wiringDiagram','scsWiringDetails','scsHelp','boardPinHint','wiringSummary'].map(id=>[id,$('#'+id)]))});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  const PICO_LEFT_PINS'),app.indexOf('  function updateBoardUi')),context);
const profiles=vm.runInContext('BOARD_PROFILES',context);
for (const [key, profile] of Object.entries(profiles)) {
  context.key=key; vm.runInContext('selectedBoard=key',context);
  context.workspace={getAllBlocks:()=>[block('pwm_setup',{CHANNEL:1,PIN:profile.pins[0]}),block('pwm_setup',{CHANNEL:2,PIN:profile.pins[1]})]};
  vm.runInContext('renderWiringDiagram()',context);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-servo="pwm"]').length,2);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-signal]').length,2);
  assert.ok(!$('#wiringDiagram').innerHTML.includes('undefined'));
  context.workspace={getAllBlocks:()=>[block('sts3235_setup',{PIN:profile.pins[0]}),block('sts3235_move',{ID:1}),block('sts3235_move',{ID:2})]};
  vm.runInContext('renderWiringDiagram()',context);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-chain]').length,3);
  context.workspace={getAllBlocks:()=>[]}; vm.runInContext('renderWiringDiagram()',context);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-servo]').length,0);
}
console.log('PASS: app wiring renderer for 8 boards, multi-PWM, serial chains, removal');
