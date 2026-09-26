const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Blockly = require('blockly');
const Exchange = require('../exchange.js');
const Basic = require('../basic.js');
const app = fs.readFileSync('app.js', 'utf8');
const workspace = new Blockly.Workspace();
const context = vm.createContext({Blockly, BasicBlocks: Basic, ServoBlocks: require('../servo.js'), PicoJog: require('../jog.js'), GeekDisplay: require('../display.js'), workspace,
  localStorage: {getItem: () => 'pico'}, encoder: new TextEncoder(), showToast: () => {}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'), app.indexOf('  const elements')), context);
vm.runInContext(app.slice(app.indexOf('  const theme'), app.indexOf('  const workspace')), context);
vm.runInContext(app.slice(app.indexOf('  function pyString'), app.indexOf('  const PICO_LEFT_PINS')), context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'), app.indexOf('  function getUartControllerConfig')), context);
const profiles = vm.runInContext('BOARD_PROFILES', context);
function catalog(board='pico') {
  context.boardUnderTest = board;
  vm.runInContext('selectedBoard = boardUnderTest', context);
  return Exchange.catalog(Blockly, vm.runInContext('buildToolbox()', context));
}
const node = (type, fields={}, inputs={}) => ({type, fields, inputs: Object.fromEntries(Object.entries(inputs).map(([key,b])=>[key,{block:b}]))});
const num = value => node('basic_number',{NUM:value});
const chain = (...items) => items.reduceRight((next,item)=>({...item,...(next?{next:{block:next}}:{})}),null);
const wrap = (first,board='pico') => ({format:'picoblocks',version:1,board,workspace:{blocks:{languageVersion:0,blocks:[{type:'program_start',...(first?{next:{block:first}}:{})}]}}});
const parse = data => Exchange.parse(typeof data === 'string' ? data : JSON.stringify(data),profiles,catalog);
const sources=[];
function generate(data) {
  const parsed=parse(data);
  Blockly.serialization.workspaces.load(parsed.workspace,workspace);
  assert.equal(workspace.getAllBlocks(false).length,parsed.count);
  assert.equal(workspace.getTopBlocks(false).length,1);
  const result=vm.runInContext('generatePython()',context);
  sources.push(result);
  return result;
}
for (const board of Object.keys(profiles)) {
  const schema=catalog(board);
  assert.equal(Boolean(schema.wifi_jog_setup),Boolean(profiles[board].wifi));
  assert.equal(Boolean(schema.lcd_print),profiles[board].layout === 'geek');
  assert.equal(JSON.stringify(schema.basic_adc.fields.PIN.options),JSON.stringify(profiles[board].pins.filter(p=>p>=26&&p<=29).map(String)));
  const categories=vm.runInContext('buildToolbox().contents.map(c=>c.name)',context);
  assert.ok(categories.indexOf('PWMサーボ')<categories.indexOf('SCS009'));
  assert.ok(categories.indexOf('SCS009')<categories.indexOf('XL330'));
  assert.ok(categories.indexOf('XL330')<categories.indexOf('STS3215'));
  assert.equal(categories.at(-1), 'STS3235');
  assert.ok(vm.runInContext('buildToolbox().contents.find(c=>c.name==="SCS009").contents.every(c=>c.kind==="block")', context));
  const prompt=Exchange.prompt(board,profiles[board],schema);
  assert.ok(prompt.includes('AI_GUIDE.md') && prompt.includes('basic_map'));
  generate(wrap(node('basic_print',{}, {VALUE:node('basic_adc',{PIN:schema.basic_adc.fields.PIN.options[0],MODE:'RAW'})}),board));
}
const schema=catalog();
for (const board of ['rp2040_geek','rp2350_geek']) {
  const source=generate(wrap(chain(node('lcd_clear'),node('lcd_usb_mirror',{ENABLED:'1'}),node('basic_print',{}, {VALUE:node('basic_text',{TEXT:'READY'})}),node('lcd_print',{}, {VALUE:num(123)}),node('lcd_line',{ROW:2},{VALUE:node('basic_adc',{PIN:'28',MODE:'RAW'})}),node('uart_controller_setup')),board));
  assert.ok(source.includes('_get_lcd().println(123)'));
  assert.ok(source.includes('_lcd_serial_print("READY")'));
  assert.ok(source.includes('_get_lcd().line(2, (_adc_28.read_u16()))'));
  assert.equal((source.match(/class GeekTextLCD:/g)||[]).length,1);
  assert.ok(vm.runInContext('validateProgram()',context));
  vm.runInContext("selectedBoard='pico'",context);
  assert.equal(vm.runInContext('validateProgram()',context),false);
}
assert.throws(()=>parse(wrap(node('lcd_print',{}, {VALUE:num(1)}),'pico')),/未対応/);
for (const [type,spec] of Object.entries(schema).filter(([type])=>type.startsWith('basic_'))) {
  const fields=Object.fromEntries(Object.entries(spec.fields).map(([name,f])=>[name,f.default]));
  const b=node(type,fields);
  generate(wrap(spec.output ? node('basic_print',{}, {VALUE:b}) : b));
}
for (const op of ['ADD','SUB','MUL','DIV','MOD']) {
  const code=generate(wrap(node('basic_print',{}, {VALUE:node('basic_math',{OP:op},{A:num(12),B:num(3)})})));
  assert.ok(code.includes('print((12 '));
}
for (const model of ['pwm','scs009','xl330','sts3215','sts3235']) {
  const fields=model==='pwm'?{CHANNEL:1,PIN:'0',MIN_US:1000,MAX_US:2000}:{PIN:'0',BAUD:'1000000'};
  generate(wrap(chain(node(model+'_setup',fields),node(model+'_value',model==='pwm'?{CHANNEL:1}:{ID:1},{VALUE:node('basic_map',{}, {VALUE:num(65535),IN_MIN:num(0),IN_MAX:num(65535),OUT_MIN:num(0),OUT_MAX:num(model==='pwm'?180:1023)})}))));
  assert.equal(vm.runInContext('validateProgram()',context),true);
}
const get = () => node('basic_get',{NAME:'値'});
const scenario=wrap(chain(
  node('basic_set',{NAME:'値'},{VALUE:num(0)}),
  node('basic_repeat',{}, {TIMES:num(3),DO:node('basic_change',{NAME:'値'},{VALUE:num(2)})}),
  node('basic_if',{}, {IF:node('basic_compare',{OP:'EQ'},{A:get(),B:num(6)}),DO:node('basic_print',{}, {VALUE:node('basic_join',{}, {A:node('basic_text',{TEXT:'value='}),B:get()})}),ELSE:node('basic_print',{}, {VALUE:node('basic_text',{TEXT:'bad'})})}),
  node('basic_print',{}, {VALUE:node('basic_adc',{PIN:'26',MODE:'VOLT'})}),
  node('basic_write',{PIN:'0'},{VALUE:node('basic_boolean',{VALUE:'TRUE'})}),
  node('basic_wait',{}, {MS:num(10)}),
  node('basic_print',{}, {VALUE:node('basic_map',{}, {VALUE:num(99999),IN_MIN:num(0),IN_MAX:num(65535),OUT_MIN:num(0),OUT_MAX:num(180)})})
));
const runtimeScenario=generate(scenario);
assert.equal(vm.runInContext('validateProgram()',context),true);
assert.ok(runtimeScenario.includes('user_5024 += 2'));
// Accept code fences; reject unknown types, injection, hidden executable state and wrong sockets.
parse('```json\n'+JSON.stringify(scenario)+'\n```');
const invalid = [
  wrap(node('made_up')),
  wrap(node('basic_number',{NUM:1})),
  wrap(node('basic_write',{PIN:'0);evil()'},{VALUE:num(1)})),
  wrap(node('pwm_move',{CHANNEL:1,ANGLE:181})),
  wrap(node('basic_print',{}, {VALUE:node('basic_wait')})),
  wrap(node('basic_if',{}, {IF:num(1)})),
  wrap(node('basic_print',{}, {VALUE:node('basic_math',{OP:'import os'})})),
  wrap({...node('basic_wait'),extraState:{evil:true}}),
  wrap(node('basic_wait',{}, {BAD:num(1)})),
  wrap(node('basic_print',{}, {VALUE:node('basic_adc',{PIN:'29'})}),'pico'),
  wrap(node('wifi_jog_setup',{SSID:'test',PASSWORD:'testpass'}),'pico'),
  wrap(node('program_start')),
];
for(const data of invalid) assert.throws(()=>parse(data));
assert.throws(()=>parse('{broken'));
assert.throws(()=>parse(' '.repeat(300001)));
const tooDeep = chain(...Array.from({length:81},()=>node('basic_wait')));
assert.throws(()=>parse(wrap(tooDeep)));
assert.throws(()=>parse({...wrap(null),board:'__proto__'}));
generate(wrap(chain(node('pwm_setup',{PIN:'26',CHANNEL:1,MIN_US:1000,MAX_US:2000}),node('basic_print',{}, {VALUE:node('basic_adc',{PIN:'26'})}))));
assert.equal(vm.runInContext('validateProgram()',context),false);
generate(wrap(chain(node('basic_write',{PIN:'0'},{VALUE:num(1)}),node('basic_print',{}, {VALUE:node('basic_read',{PIN:'0',PULL:'UP'})}))));
assert.equal(vm.runInContext('validateProgram()',context),false);
generate(wrap(node('basic_set',{NAME:'x\nimport os'},{VALUE:node('basic_text',{TEXT:'"\nimport os'})})));
assert.ok(Basic.variableName('x\nimport os').match(/^user_[0-9a-f_]+$/));
generate(wrap(chain(node('pwm_setup',{PIN:'0',CHANNEL:1,MIN_US:1000,MAX_US:2000}),node('gpio_write',{PIN:0,VALUE:'1'}))));
assert.equal(vm.runInContext('validateProgram()',context),false);
// The public guide's examples must remain importable.
const guide=fs.readFileSync('AI_GUIDE.md','utf8');
for(const match of guide.matchAll(/```json\n([\s\S]*?)\n```/g)) generate(JSON.parse(match[1]));
// Exercise the actual replacement function: preserve on error, restore backup and board.
const saved = new Map();
context.localStorage = {getItem:key=>saved.get(key) ?? null,setItem:(key,value)=>saved.set(key,value)};
context.isBusy=false; context.controllerActive=false; context.backupKey='backup';
context.elements={pythonCode:{textContent:''}}; context.$=()=>({});
context.updateBoardUi=()=>{}; context.updateControllerUi=()=>{};
context.Blockly={...Blockly,svgResize:()=>{}};
workspace.updateToolbox=()=>{};
vm.runInContext(app.slice(app.indexOf('  function normalizeWorkspace'),app.indexOf('  function pyString')),context);
vm.runInContext(app.slice(app.indexOf('  function replaceFromExchange'),app.indexOf('  $("#importBlocks").addEventListener')),context);
function apply(data, restoring=false) { context.importData=data; context.restoring=restoring; return vm.runInContext('replaceFromExchange(importData, restoring)',context); }
const original=vm.runInContext('generatePython()',context);
const originalBoard=vm.runInContext('selectedBoard',context);
const good=parse(wrap(node('basic_wait',{}, {MS:num(123)}),'xiao_rp2350'));
// parse's test catalog changes the board; the production callback preserves it.
context.boardUnderTest=originalBoard; vm.runInContext('selectedBoard=boardUnderTest',context);
apply(good);
assert.ok(context.elements.pythonCode.textContent.includes('Seeed Studio XIAO RP2350'));
const backup=saved.get('backup');
assert.ok(backup);
const conflict=parse(wrap(chain(node('pwm_setup',{PIN:'26',CHANNEL:1,MIN_US:1000,MAX_US:2000}),node('basic_print',{}, {VALUE:node('basic_adc',{PIN:'26'})})),'xiao_rp2350'));
const beforeError=vm.runInContext('generatePython()',context);
assert.throws(()=>apply(conflict),/別々のピン/);
assert.equal(vm.runInContext('generatePython()',context),beforeError);
assert.equal(saved.get('backup'),backup);
apply(JSON.parse(backup),true);
assert.equal(vm.runInContext('selectedBoard',context),originalBoard);
assert.equal(vm.runInContext('generatePython()',context),original);
context.controllerActive=true;
assert.throws(()=>apply(good),/停止/);
workspace.dispose();
if(process.argv.includes('--json')) process.stdout.write(JSON.stringify({sources,runtimeScenario}));
else console.log(`PASS: ${sources.length} generated programs, all basic blocks, 8 board catalogs, ordering, import validation, GPIO conflicts, guide examples`);
