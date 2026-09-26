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
assert.notEqual(dom.querySelector('[data-signal="pwm-1"]').getAttribute('stroke'),dom.querySelector('[data-signal="pwm-2"]').getAttribute('stroke'));
assert.ok(dom.body.textContent.includes('PWM 1 · GP2') && dom.body.textContent.includes('PWM 2 · GP3'));
for (const model of ['scs009','xl330','sts3215','sts3235']) {
  const setup = block(model+'_setup',{PIN:2});
  groups = W.groups([setup,block(model+'_move',{ID:3}),block(model+'_torque',{ID:1}),block(model+'_value',{ID:3})]);
  assert.deepEqual(groups[0].devices.map(d=>d.id),[1,3]);
  dom=svg(groups[0]);
  assert.equal(dom.querySelectorAll('[data-servo]').length,2);
  assert.equal(dom.querySelectorAll('[data-chain]').length,3); // DATA + V+ + GND
  assert.equal(dom.querySelectorAll('[data-signal]').length,1);
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

const mixedBlocks=[...Array.from({length:16},(_,i)=>block('pwm_setup',{CHANNEL:i+1,PIN:i})), ...['scs009','xl330','sts3215','sts3235'].map((m,i)=>block(m+'_setup',{PIN:20+i}))];
const mixed=W.groups(mixedBlocks);
assert.equal(new Set(mixed.flatMap(g=>g.devices.map(d=>d.colour))).size,20);
dom=svg(mixed);
assert.equal(dom.querySelectorAll('[data-signal]').length,20);
assert.equal(dom.querySelectorAll('[data-servo]').length,20);
assert.equal(dom.querySelectorAll('[data-supply]').length,5);
for (const g of mixed) {
  const alone=W.groups(mixedBlocks.filter(b=>b.type===g.model+'_setup'))[0];
  assert.deepEqual(g.devices.map(d=>d.colour),alone.devices.map(d=>d.colour));
}

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
  const mixedSetups=[block('pwm_setup',{CHANNEL:1,PIN:profile.pins[0]}),block('pwm_setup',{CHANNEL:2,PIN:profile.pins.at(-1)}),block('scs009_setup',{PIN:profile.pins[1]}),block('sts3235_setup',{PIN:profile.pins[2]})];
  context.workspace={getAllBlocks:()=>mixedSetups}; $('#wiringDevice').value='all';
  vm.runInContext('renderWiringDiagram()',context);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-signal]').length,4);
  assert.equal($('#signalLegend').children.length,4);
  assert.equal(new Set([...$('#wiringDiagram').querySelectorAll('[data-signal]')].map(p=>p.getAttribute('stroke'))).size,4);
  const lastPin=Number(profile.pins.at(-1));
  const route=$('#wiringDiagram').querySelector(`[data-pin="${lastPin}"]`).getAttribute('d');
  // Right-edge pins must exit right, not cut across the board under its body.
  if (profile.layout==='pico' || profile.layout==='xiao') assert.match(route,/^M\d+(?:\.\d+)? \d+(?:\.\d+)? H3\d\d /);
  if (profile.layout==='geek') assert.match(route,/^M\d+ 218 V27/);
  $('#wiringDevice').value='sts3235_setup'; vm.runInContext('renderWiringDiagram()',context);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-signal]').length,1);
  assert.equal($('#signalLegend').children.length,1);
  context.workspace={getAllBlocks:()=>[]}; vm.runInContext('renderWiringDiagram()',context);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-servo]').length,0);
}
console.log('PASS: app wiring renderer for 9 boards, multi-PWM, serial chains, removal');
vm.runInContext("selectedBoard='atom_lite'",context);
for(const pin of [19,26,32]) {
  context.workspace={getAllBlocks:()=>[block('scs009_setup',{PIN:pin}),block('scs009_move',{ID:1}),block('scs009_move',{ID:2})]};
  vm.runInContext('renderWiringDiagram()',context);
  assert.equal($('#wiringDiagram').querySelectorAll('[data-pullup]').length,1,'One resistor per bus, not per ID');
  assert.equal($('#wiringDiagram').querySelector('[data-pullup]').getAttribute('data-pin'),String(pin));
  assert.match($('#wiringDiagram').querySelector('[data-pullup-source]').getAttribute('d'),/^M90 186 /,'Starts at expansion 3V3, not Grove 5V');
  assert.match($('#wiringDiagram').querySelector('[data-pullup-data]').getAttribute('d'),/H310 V\d+ H190$/,'Routes around the external supply card');
  assert.equal($('#atomPullupGuide').hidden,false);
  assert.ok($('#wiringDiagram').textContent.includes('2.2 kΩ'));
}
context.workspace={getAllBlocks:()=>[block('scs009_setup',{PIN:26}),block('sts3215_setup',{PIN:32})]};
vm.runInContext('renderWiringDiagram()',context);
assert.equal($('#wiringDiagram').querySelectorAll('[data-pullup]').length,2);
for(const key of ['atom_lite','pico']) {
  context.key=key;vm.runInContext('selectedBoard=key',context);
  for(const blocks of [[],[block('pwm_setup',{PIN:26,CHANNEL:1})],...(key==='pico'?[[block('scs009_setup',{PIN:26})]]:[])]) {
    context.workspace={getAllBlocks:()=>blocks};vm.runInContext('renderWiringDiagram()',context);
    assert.equal($('#wiringDiagram').querySelectorAll('[data-pullup]').length,0);
    assert.equal($('#atomPullupGuide').hidden,true);
  }
}
console.log('PASS: Grove 26/32 and expansion signal wiring, per-bus optional pull-up to 3V3, no PWM/RP/empty pull-ups');
