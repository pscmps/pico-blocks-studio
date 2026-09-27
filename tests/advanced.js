const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Blockly=require('blockly'),Basic=require('../basic.js'),Exchange=require('../exchange.js');
const app=fs.readFileSync('app.js','utf8'),workspace=new Blockly.Workspace();
const context=vm.createContext({Blockly,BasicBlocks:Basic,ServoBlocks:require('../servo.js'),PicoJog:require('../jog.js'),GeekDisplay:require('../display.js'),workspace,localStorage:{getItem:()=> 'pico'},encoder:new TextEncoder(),showToast:()=>{}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  const theme'),app.indexOf('  const workspace')),context);
vm.runInContext(app.slice(app.indexOf('  function pyString'),app.indexOf('  const PICO_LEFT_PINS')),context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'),app.indexOf('  function getUartControllerConfig')),context);
const profiles=vm.runInContext('BOARD_PROFILES',context);
const node=(type,fields={},inputs={})=>({type,fields,inputs:Object.fromEntries(Object.entries(inputs).map(([k,b])=>[k,{block:b}]))});
const num=n=>node('basic_number',{NUM:n}),text=s=>node('basic_text',{TEXT:s}),get=n=>node('basic_get',{NAME:n});
const chain=(...items)=>items.reduceRight((next,b)=>({...b,...(next?{next:{block:next}}:{})}),null);
const print=value=>node('basic_print',{}, {VALUE:value});
const set=(name,value)=>node('basic_set',{NAME:name},{VALUE:value});
const change=(name,by=1)=>node('basic_change',{NAME:name},{VALUE:num(by)});
const sources=[];
function catalog(board='pico') {
  context.board=board;vm.runInContext('selectedBoard=board',context);
  return Exchange.catalog(Blockly,vm.runInContext('buildToolbox()',context));
}
function load(first,board='pico') {
  const json={format:'picoblocks',version:1,board,workspace:{blocks:{languageVersion:0,blocks:[{type:'program_start',...(first?{next:{block:first}}:{})}]}}};
  const parsed=Exchange.parse(JSON.stringify(json),profiles,catalog);
  Blockly.serialization.workspaces.load(parsed.workspace,workspace);
  return vm.runInContext('validateProgram()',context);
}
function generate(first,board='pico',valid=true) {
  assert.equal(load(first,board),valid);
  const code=vm.runInContext('generatePython()',context);sources.push(code);return code;
}
let advancedCount=0;
for(const [board,profile] of Object.entries(profiles)) {
  const schema=catalog(board),toolbox=vm.runInContext('buildToolbox()',context);
  const base=toolbox.contents.find(c=>c.name==='基本'),index=toolbox.contents.indexOf(base);
  assert.equal(toolbox.contents[index+1].name,'高度なブロック');
  assert.ok(!base.contents.some(c=>c.name==='うごき'));
  const io=base.contents.find(c=>c.name==='入力・出力');
  assert.equal(io.contents.some(c=>c.type==='pico_led'),profile.ledPin!==null);
  assert.ok(io.contents.some(c=>c.type==='basic_write'));
  const all=[];const walk=items=>items.forEach(i=>{if(i.type)all.push(i.type);if(i.contents)walk(i.contents);});walk(toolbox.contents);
  assert.ok(!all.includes('gpio_write')&&!all.includes('wait_ms'));
  assert.equal(all.filter(t=>t==='basic_wait').length,1);
  assert.ok(schema.gpio_write&&schema.wait_ms,'legacy import');
  advancedCount=Object.keys(schema).filter(s=>s.startsWith('adv_')).length;
  assert.ok(advancedCount>=40);
  for(const type of ['adv_irq','adv_pwm'])assert.deepEqual(schema[type].fields.PIN.options,profile.pins.map(String));
  const pins=profile.pins;
  generate(chain(node('adv_irq',{PIN:String(pins[0]),DEBOUNCE:20},{DO:change('irq')}),node('adv_timer',{TIMER:1,PERIOD:5},{DO:change('timer')})),board);
  generate(chain(node('adv_i2c_setup',{BUS:1,SCL:String(pins[0]),SDA:String(pins[1])}),print(node('adv_i2c_scan',{BUS:1}))),board);
  generate(chain(node('adv_spi_setup',{BUS:1,SCK:String(pins[0]),MOSI:String(pins[1]),MISO:String(pins[2]),CS:String(pins[3])}),print(node('adv_spi_transfer',{BUS:1}))),board);
}
const schema=catalog();
// Compile every block's generated syntax, including meaningful scope for flow/arg.
for(const [type,spec] of Object.entries(schema).filter(([t])=>t.startsWith('adv_'))) {
  const fields=Object.fromEntries(Object.entries(spec.fields).map(([k,v])=>[k,v.default]));
  let b=node(type,fields);
  if(type==='adv_arg')b=node('adv_function',{NAME:'data'},{RETURN:b});
  else if(type==='adv_flow')b=node('basic_repeat',{}, {TIMES:num(1),DO:b});
  else if(spec.output)b=print(b);
  load(b);sources.push(vm.runInContext('generatePython()',context));
}
const list=node('adv_list_new',{}, {A:num(1),B:num(2),C:num(3)});
const dataProgram=generate(chain(
  set('list',list),node('adv_list_append',{}, {LIST:get('list'),VALUE:num(4)}),node('adv_list_set',{}, {LIST:get('list'),INDEX:num(0),VALUE:num(9)}),
  print(node('adv_list_get',{}, {LIST:get('list'),INDEX:num(0)})),print(node('adv_length',{}, {VALUE:get('list')})),
  print(node('adv_list_pop',{}, {LIST:get('list')})),print(node('adv_contains',{}, {VALUE:get('list'),ITEM:num(2)})),
  set('sum',num(0)),node('adv_for_each',{NAME:'item'},{LIST:get('list'),DO:node('basic_change',{NAME:'sum'},{VALUE:get('item')})}),print(get('sum')),
  set('dict',node('adv_dict_empty')),node('adv_dict_set',{}, {DICT:get('dict'),KEY:text('value'),VALUE:get('sum')}),print(node('adv_dict_get',{}, {DICT:get('dict'),KEY:text('value'),DEFAULT:num(-1)})),
  node('adv_function',{NAME:'twice'},{DO:change('calls'),RETURN:node('basic_math',{OP:'MUL'},{A:node('adv_arg'),B:num(2)})}),print(node('adv_call',{NAME:'twice'},{ARG:num(7)})),print(get('calls')),
  print(node('adv_split',{}, {TEXT:text('a,b'),SEP:text(',')})),print(node('adv_replace',{}, {TEXT:text('abc'),OLD:text('b'),NEW:text('X')})),
  print(node('adv_convert',{TYPE:'int'},{VALUE:text('42')})),print(node('adv_bitwise',{OP:'AND'},{A:num(7),B:num(3)})),
  set('json',node('adv_json_encode',{}, {VALUE:get('dict')})),print(node('adv_dict_get',{}, {DICT:node('adv_json_decode',{}, {TEXT:get('json')}),KEY:text('value')})),
  node('adv_try',{}, {DO:print(node('adv_list_get',{}, {LIST:get('list'),INDEX:num(99)})),EXCEPT:print(text('caught')),FINALLY:print(text('finally'))}),
  print(node('adv_slice',{}, {VALUE:get('list'),START:num(1),END:num(3)})),print(node('adv_array',{TYPE:'h'},{LIST:get('list')})),print(node('adv_bytes',{}, {LIST:get('list')})),
  node('basic_repeat',{}, {TIMES:num(3),DO:node('adv_flow',{ACTION:'BREAK'})}),
  print(node('adv_dict_keys',{}, {DICT:get('dict')}))
));
const hardwareProgram=generate(chain(
  node('adv_i2c_setup',{BUS:1,SCL:'0',SDA:'1'}),print(node('adv_i2c_scan',{BUS:1})),
  node('adv_i2c_write',{BUS:1,ADDRESS:64,REGISTER:2},{DATA:list}),print(node('adv_i2c_read',{BUS:1,ADDRESS:64,REGISTER:2,SIZE:3})),
  node('adv_spi_setup',{BUS:1,SCK:'2',MOSI:'3',MISO:'4',CS:'5'}),print(node('adv_spi_transfer',{BUS:1},{DATA:list})),
  node('adv_pwm',{PIN:'6',FREQ:1000},{DUTY:num(12345)}),node('adv_pwm_stop',{PIN:'6'})
));
const eventChain=chain(node('adv_irq',{PIN:'0',DEBOUNCE:10},{DO:change('edges')}),node('adv_timer',{TIMER:1,PERIOD:5},{DO:change('ticks')}),node('basic_wait',{}, {MS:num(12)}));
const eventProgram=generate(eventChain);
const eventJogProgram=generate(chain(node('uart_controller_setup'),eventChain));
assert.ok(eventJogProgram.includes('_controller_poll()'));
assert.ok(eventJogProgram.includes('_adv_wait(max(0, int(12)))'));
const legacy=generate(chain(node('gpio_write',{PIN:0,VALUE:'1'}),node('wait_ms',{MS:10})));
assert.ok(legacy.includes('Pin(0, Pin.OUT).value(1)')&&legacy.includes('time.sleep_ms(10)'));
const invalid=[
  node('adv_call_do',{NAME:'missing'}),print(node('adv_arg')),node('adv_flow'),
  chain(node('adv_function',{NAME:'x'}),node('adv_function',{NAME:'x'})),
  node('basic_repeat',{}, {DO:node('adv_timer')}),
  chain(node('adv_irq',{PIN:'0'}),node('basic_write',{PIN:'0'})),
  chain(node('adv_irq',{PIN:'0'}),node('adv_irq',{PIN:'0'})),
  chain(node('adv_i2c_setup',{SCL:'0',SDA:'0'})),
  chain(node('adv_spi_setup',{SCK:'0',MOSI:'1',MISO:'2',CS:'3'}),node('pwm_setup',{PIN:'3'})),
  chain(node('adv_pwm',{PIN:'0'}),node('pwm_setup',{PIN:'1'})),
  chain(node('adv_pwm',{PIN:'0'}),node('adv_pwm',{PIN:'16'})),
  print(node('adv_i2c_read')),print(node('adv_spi_transfer')),node('adv_irq_stop'),node('adv_timer_stop'),
];
for(const b of invalid)assert.equal(load(b),false,JSON.stringify(b));
const malicious=node('adv_function',{NAME:'x\nimport os'},{RETURN:num(1)});
assert.ok(!generate(chain(malicious,print(node('adv_call',{NAME:'x\nimport os'})))).includes('\nimport os'));
const outputBlock=workspace.newBlock('basic_write');
assert.equal(outputBlock.inputList.length,1);assert.equal(outputBlock.getInputsInline(),true);
workspace.dispose();
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify({sources,dataProgram,hardwareProgram,eventProgram,eventJogProgram}));
else console.log(`PASS: ${advancedCount} advanced blocks, ${sources.length} generated programs, 9 board catalogs, consolidated toolbox, legacy imports, scopes, pin/PWM conflicts and code-injection checks`);
