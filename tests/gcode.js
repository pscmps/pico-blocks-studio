const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Blockly=require('blockly'),Basic=require('../basic.js'),Exchange=require('../exchange.js'),Samples=require('../samples.js'),Gcode=require('../gcode.js');
const app=fs.readFileSync('app.js','utf8'),workspace=new Blockly.Workspace();
const context=vm.createContext({Blockly,BasicBlocks:Basic,ServoBlocks:require('../servo.js'),PicoJog:require('../jog.js'),GeekDisplay:require('../display.js'),workspace,localStorage:{getItem:key=>key==='picoblocks-show-development-v1'?'1':'pico2'},encoder:new TextEncoder(),showToast:()=>{}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  const theme'),app.indexOf('  const workspace')),context);
vm.runInContext(app.slice(app.indexOf('  function pyString'),app.indexOf('  const PICO_LEFT_PINS')),context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'),app.indexOf('  function getUartControllerConfig')),context);
const profiles=vm.runInContext('BOARD_PROFILES',context),programs=[];
const catalog=board=>{context.board=board;vm.runInContext('selectedBoard=board',context);return Exchange.catalog(Blockly,vm.runInContext('buildToolbox()',context));};
function load(board='pico2') {
  const sample=Samples.plotterflow(board),parsed=Exchange.parse(JSON.stringify(sample),profiles,catalog);
  Blockly.serialization.workspaces.load(parsed.workspace,workspace);
  return workspace.getAllBlocks(false);
}
const valid=()=>vm.runInContext('validateProgram()',context);
for(const board of ['pico2','pico2w']) {
  load(board);assert.equal(valid(),true);
  const toolbox=vm.runInContext('buildToolbox()',context);
  assert.equal(toolbox.contents.find(c=>c.name==='高度なブロック').contents.at(-1).name,'Gcode');
  assert.equal(Object.keys(catalog(board)).filter(k=>k.startsWith('gcode_')).length,10); // Nine visible + legacy reply.
  const gcodeTools=Gcode.toolbox(profiles[board]).contents.map(b=>b.type);
  assert.ok(gcodeTools.includes('gcode_execute')&&!gcodeTools.includes('gcode_reply'));
  const execution=workspace.getAllBlocks().find(b=>b.type==='gcode_execute');
  assert.ok(execution.previousConnection&&execution.nextConnection&&!execution.outputConnection);
  assert.equal(execution.getParent().type,'basic_if');
  assert.ok(!workspace.getAllBlocks().some(b=>b.type==='gcode_reply'));
  const code=vm.runInContext('generatePython()',context);
  assert.ok(code.includes('StepperPIO(2, 3, 4, 5, 7, True)'));
  assert.ok(code.includes('Pen(12, 50, 1000, 1800)'));
  assert.ok(code.includes('CartesianPlanner(80, 80)'));
  assert.ok(!code.includes('未対応'));assert.equal((code.match(/print\(_pf_reply\(user_/g)||[]).length,1);
  assert.ok(code.includes('_pf_stepper.close()'));
  programs.push({board,code});
  const saved=Blockly.serialization.workspaces.save(workspace);Blockly.serialization.workspaces.load(saved,workspace);assert.equal(valid(),true);
}
for(const board of Gcode.shield.boardKeys) {
  const blocks=load(board),profile=profiles[board],preset=blocks.find(b=>b.type==='gcode_shield');
  assert.equal(valid(),true,board);
  assert.equal(preset.getFieldValue('CARRIER'),profile.shield);
  const code=vm.runInContext('generatePython()',context),pin=board.startsWith('shield_pico')?12:9;
  assert.ok(code.includes('StepperPIO(2, 3, 4, 5, 7, True)'));
  assert.ok(code.includes(`Pen(${pin}, 50, 1000, 1800)`));
  assert.ok(code.includes('_pf_stepper.close()')&&code.includes('_pf_pen.close()'));
  assert.ok(code.includes(`board=${board}-stepdir`));
  programs.push({board,code});
  assert.equal(!!profile.wifi,['shield_picow','shield_pico2w'].includes(board));
  assert.ok(profile.firmwareUrl.includes(board.startsWith('shield_pico')?'micropython.org':'WAVESHARE-RP2350A'));
  const saved=Blockly.serialization.workspaces.save(workspace);Blockly.serialization.workspaces.load(saved,workspace);assert.equal(valid(),true);
  const restored=workspace.getAllBlocks().find(b=>b.type==='gcode_shield');
  restored.setFieldValue(profile.shield==='pico'?'lcd147a':'pico','CARRIER');assert.equal(valid(),false,'carrier mismatch');
  load(board);workspace.newBlock('gcode_shield');assert.equal(valid(),false,'duplicate preset');
  load(board);workspace.newBlock('gcode_pen');assert.equal(valid(),false,'duplicate pen');
  load(board);workspace.newBlock('gcode_stepper');assert.equal(valid(),false,'duplicate stepper');
  load(board);const gpio=workspace.newBlock('basic_write');gpio.setFieldValue(String(pin),'PIN');assert.equal(valid(),false,'preset reserves PWM pin');
  load(board);const p=workspace.getAllBlocks().find(b=>b.type==='gcode_shield');p.setFieldValue(400,'FREQ');p.setFieldValue(3000,'UP');assert.equal(valid(),false,'period safety');
  load(board);workspace.getAllBlocks().find(b=>b.type==='gcode_shield').unplug(true);assert.equal(valid(),false,'setup must be in main chain');
}
load();workspace.newBlock('gcode_shield');assert.equal(valid(),false,'shield setup on plain board');
load('shield_touch2');const unavailableAdc=workspace.newBlock('basic_adc');
assert.equal(unavailableAdc.getFieldValue('PIN'),'-1');assert.equal(valid(),false,'ADC sentinel cannot execute');
let blocks=load(),step=blocks.find(b=>b.type==='gcode_stepper'),pen=blocks.find(b=>b.type==='gcode_pen');
step.setFieldValue('4','Y_STEP');assert.equal(valid(),false);step.setFieldValue('3','Y_STEP');
pen.setFieldValue('2','PIN');assert.equal(valid(),false);pen.setFieldValue('12','PIN');
pen.setFieldValue(400,'FREQ');pen.setFieldValue(3000,'UP');assert.equal(valid(),false);
load();workspace.newBlock('uart_controller_setup');assert.equal(valid(),false);
load();workspace.newBlock('wifi_jog_setup');assert.equal(valid(),false);
load();workspace.newBlock('adv_timer');assert.equal(valid(),false);
load();workspace.newBlock('scs009_setup');assert.equal(valid(),false);
load();workspace.newBlock('pwm_setup');assert.equal(valid(),false);
load();workspace.newBlock('gcode_controller');assert.equal(valid(),false);
load();workspace.getAllBlocks().find(b=>b.type==='gcode_controller').dispose(true);assert.equal(valid(),false,'execution requires controller');
blocks=load();const earlyExecute=blocks.find(b=>b.type==='gcode_execute');earlyExecute.unplug(true);
const earlyStart=blocks.find(b=>b.type==='program_start'),oldFirst=earlyStart.getNextBlock();oldFirst.unplug();
earlyStart.nextConnection.connect(earlyExecute.previousConnection);earlyExecute.nextConnection.connect(oldFirst.previousConnection);
assert.equal(valid(),false,'execution before setup is rejected');
// Legacy value-style files stay importable and generate the same single execution.
const legacy=Samples.plotterflow('pico2');
function legacyReply(node) {
  if(node.type==='gcode_execute')return {type:'basic_print',inputs:{VALUE:{block:{type:'gcode_reply',inputs:node.inputs}}}};
  for(const input of Object.values(node.inputs||{}))for(const key of ['block','shadow'])if(input[key])input[key]=legacyReply(input[key]);
  if(node.next)node.next.block=legacyReply(node.next.block);
  return node;
}
legacy.workspace.blocks.blocks=legacy.workspace.blocks.blocks.map(legacyReply);
Blockly.serialization.workspaces.load(Exchange.parse(JSON.stringify(legacy),profiles,catalog).workspace,workspace);
assert.equal(valid(),true,'legacy JSON is still valid');
assert.equal((vm.runInContext('generatePython()',context).match(/print\(_pf_reply\(user_/g)||[]).length,1);
load();const emptyExecution=workspace.getAllBlocks().find(b=>b.type==='gcode_execute');
emptyExecution.getInputTargetBlock('LINE').dispose();
assert.equal(Gcode.statement(emptyExecution,(_,fallback)=>fallback),"print(_pf_reply(''))\n");
load();workspace.getAllBlocks().find(b=>b.type==='gcode_controller').unplug(true);assert.equal(valid(),false);
blocks=load();const control=blocks.find(b=>b.type==='gcode_controller');control.unplug(true);const start=blocks.find(b=>b.type==='program_start'),first=start.getNextBlock();first.unplug();start.nextConnection.connect(control.previousConnection);control.nextConnection.connect(first.previousConnection);assert.equal(valid(),false);
load();const gpio=workspace.newBlock('basic_write');gpio.setFieldValue('2','PIN');assert.equal(valid(),false);
load();const pwm=workspace.newBlock('adv_pwm');pwm.setFieldValue('13','PIN');assert.equal(valid(),false);
blocks=load();assert.ok(Gcode.validate(blocks,profiles.atom_lite));
// Source-only parsing is useful without hardware initialization.
workspace.clear();const p=workspace.newBlock('gcode_parse');assert.equal(Gcode.validate([p],profiles.pico2),'');
assert.equal(Gcode.expression(p,()=>"'G1 X2'"),"_pf_parse_dict('G1 X2')");
// Wiring tracks edits and has separate supplies, two drivers, four coil wires per axis.
const W=require('../wiring.js'),{JSDOM}=require('jsdom');blocks=load();
for(const board of Gcode.shield.boardKeys) {
  const profile=profiles[board],blocks=load(board),diagram=Gcode.shield.render(profile,blocks);
  const d=new JSDOM('<svg>'+diagram.content+'</svg>').window.document;
  assert.equal(d.querySelectorAll('[data-shield-driver]').length,2);
  assert.equal(d.querySelectorAll('[data-shield-connector]').length,9);
  assert.equal(d.querySelectorAll('[data-shield-coil]').length,8);
  assert.equal(d.querySelectorAll('[data-shield-gpio]').length,14);
  for(const ref of ['J5','J6','J7','J8','J9'])assert.equal(d.querySelector(`[data-shield-connector="${ref}"]`).getAttribute('data-active'),'true');
  for(const ref of ['J10','J11','J12','J13'])assert.equal(d.querySelector(`[data-shield-connector="${ref}"]`).getAttribute('data-active'),'false');
  const expected=profile.shield==='pico'?[4,5,6,7,10,9,11,16,12,14,15,1,2,17]:profile.shield==='lcd147a'?[15,16,17,18,2,1,3,4,5,6,7,13,14,9]:[7,9,11,19,28,20,26,27,12,21,25,10,8,24];
  assert.deepEqual(Gcode.shield.signals(profile.shield).map(p=>p.pin),expected);
  assert.ok(!diagram.content.includes('undefined'));
  const empty=new JSDOM('<svg>'+Gcode.shield.render(profile,[]).content+'</svg>').window.document;
  assert.equal(empty.querySelectorAll('[data-active="true"]').length,0);
}
blocks=load();
const draw=pin=>({layout:'pico',board:'<rect/>',dataPoint:{x:50,y:42+Number(pin)*5},groundPoint:{x:50,y:64},logicPowerPoint:{x:210,y:84}});
let drawing=W.renderPlotterflow(blocks,draw,p=>'GP'+p),dom=new JSDOM('<svg>'+drawing.content+'</svg>').window.document;
assert.equal(dom.querySelectorAll('[data-gcode-driver]').length,2);
assert.equal(dom.querySelectorAll('[data-gcode-coil]').length,8);
assert.equal(dom.querySelectorAll('[data-gcode-signal]').length,7);
assert.equal(dom.querySelectorAll('[data-gcode-supply]').length,2);
assert.match(dom.querySelector('[data-gcode-supply="motor"]').getAttribute('d'),/^M155 341 V361 H324/,'Motor positive must not overlap the GND supply lead');
// Rails must end exactly on their last branch, without dangling extensions.
for(const [selector,terminal] of [['[data-gcode-supply="motor"]','Y-VM'],['[data-gcode-vio="3v3"]','Y-VIO']]) {
  const branch=dom.querySelector(`[data-gcode-terminal="${terminal}"]`).getAttribute('d').match(/^M(\d+) (\d+) H300$/);
  assert.ok(dom.querySelector(selector).getAttribute('d').endsWith(`H${branch[1]} V${branch[2]}`),terminal);
}
assert.ok(dom.querySelector('[data-gcode-ground="board"]').getAttribute('d').endsWith('V931'),'Shared GND joins the pen supply');
for(const [type,end] of [['gcode_stepper',693],['gcode_pen',341]]) {
  const only=new JSDOM('<svg>'+W.renderPlotterflow(blocks.filter(b=>b.type===type),draw,p=>'GP'+p).content+'</svg>').window.document;
  assert.ok(only.querySelector('[data-gcode-ground="board"]').getAttribute('d').endsWith('V'+end),'GND endpoint: '+type);
}
assert.equal(dom.querySelector('[data-gcode-signal="X-STEP"]').getAttribute('data-pin'),'2');
assert.equal(dom.querySelector('[data-gcode-signal="PEN"]').getAttribute('data-pin'),'12');
assert.notEqual(dom.querySelector('[data-gcode-signal="X-STEP"]').getAttribute('stroke'),dom.querySelector('[data-gcode-signal="Y-STEP"]').getAttribute('stroke'));
blocks.find(b=>b.type==='gcode_pen').setFieldValue('14','PIN');
assert.ok(W.renderPlotterflow(blocks,draw,p=>'GP'+p).content.includes('data-gcode-pen="14"'));
const html=fs.readFileSync('index.html','utf8');assert.ok(html.includes('id="gcodeHelp"')&&html.includes('id="loadGcodeSample"'));
assert.ok(html.indexOf('gcode-runtime.js')<html.indexOf('gcode.js'));
workspace.dispose();
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify({programs,runtime:require('../gcode-runtime.js')}));
else console.log('PASS: Gcode blocks, original recipes, ordering/pin/conflict checks, persistence and driver/pen wiring');
