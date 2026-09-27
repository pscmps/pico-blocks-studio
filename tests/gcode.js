const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Blockly=require('blockly'),Basic=require('../basic.js'),Exchange=require('../exchange.js'),Samples=require('../samples.js'),Gcode=require('../gcode.js');
const app=fs.readFileSync('app.js','utf8'),workspace=new Blockly.Workspace();
const context=vm.createContext({Blockly,BasicBlocks:Basic,ServoBlocks:require('../servo.js'),PicoJog:require('../jog.js'),GeekDisplay:require('../display.js'),workspace,localStorage:{getItem:()=> 'pico2'},encoder:new TextEncoder(),showToast:()=>{}});
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
  assert.equal(Object.keys(catalog(board)).filter(k=>k.startsWith('gcode_')).length,9);
  const code=vm.runInContext('generatePython()',context);
  assert.ok(code.includes('StepperPIO(2, 3, 4, 5, 7, True)'));
  assert.ok(code.includes('Pen(12, 50, 1000, 1800)'));
  assert.ok(code.includes('CartesianPlanner(80, 80)'));
  assert.ok(!code.includes('未対応'));assert.ok(code.includes('_pf_reply(user_'));
  assert.ok(code.includes('_pf_stepper.close()'));
  programs.push({board,code});
  const saved=Blockly.serialization.workspaces.save(workspace);Blockly.serialization.workspaces.load(saved,workspace);assert.equal(valid(),true);
}
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
