const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Blockly=require('blockly'),Basic=require('../basic.js'),Exchange=require('../exchange.js'),I18n=require('../i18n.js');
const app=fs.readFileSync('app.js','utf8'),workspace=new Blockly.Workspace();
const context=vm.createContext({Blockly,BasicBlocks:Basic,ServoBlocks:require('../servo.js'),PicoJog:require('../jog.js'),GeekDisplay:require('../display.js'),workspace,localStorage:{getItem:()=> 'pico'},encoder:new TextEncoder(),showToast:()=>{}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  const theme'),app.indexOf('  const workspace')),context);
vm.runInContext(app.slice(app.indexOf('  function pyString'),app.indexOf('  const PICO_LEFT_PINS')),context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'),app.indexOf('  function getUartControllerConfig')),context);
const profiles=vm.runInContext('BOARD_PROFILES',context),schema=Exchange.catalog(Blockly,vm.runInContext('buildToolbox()',context));
const node=(type,fields={},inputs={})=>({type,fields,inputs:Object.fromEntries(Object.entries(inputs).map(([k,b])=>[k,{block:b}]))});
const num=n=>node('basic_number',{NUM:n});
const chain=(...items)=>items.reduceRight((next,b)=>({...b,...(next?{next:{block:next}}:{})}),null);
const sources=[];
function load(body,name='custom',extra=[]) {
  const json={format:'picoblocks',version:1,board:'pico',workspace:{blocks:{languageVersion:0,blocks:[chain(node('program_start'),node('adv_python_function',{NAME:name,CODE:body}),...extra)]}}};
  const parsed=Exchange.parse(JSON.stringify(json),profiles,()=>schema);
  Blockly.serialization.workspaces.load(parsed.workspace,workspace);
  return vm.runInContext('validateProgram()',context);
}
const call=node('basic_print',{}, {VALUE:node('adv_call',{NAME:'custom'},{ARG:num(3)})});
assert.equal(schema.adv_python_function.fields.CODE.maxLength,16384);
for(const body of ['result = arg * 2\nreturn result','if arg > 0:\n    return arg + 7\nreturn -1','', '# comment only', 'import math\nreturn math.sqrt(arg)', 'return "日本語"', 'for x in range(arg):\n    print(x)\nreturn arg','result = arg + 1\r\nreturn result']) {
  assert.equal(load(body,'custom',[call]),true);
  sources.push(vm.runInContext('generatePython()',context));
  const raw=workspace.getAllBlocks(false).find(b=>b.type==='adv_python_function');
  assert.equal(raw.getFieldValue('CODE'),body);
  const state=Blockly.serialization.workspaces.save(workspace);
  for(const language of ['en','ja']) {
    I18n.setLanguage(language);const warn=console.warn;console.warn=()=>{};
    try {vm.runInContext('registerBlocks()',context);}finally{console.warn=warn;}
    Blockly.serialization.workspaces.load(state,workspace);
    const saved=workspace.getAllBlocks(false).find(b=>b.type==='adv_python_function');
    assert.equal(saved.getFieldValue('CODE'),body);
    const copy=Blockly.serialization.blocks.append(Blockly.serialization.blocks.save(saved),workspace);
    assert.equal(copy.getFieldValue('CODE'),body);copy.dispose();
  }
}
assert.equal(load('return arg','custom',[node('adv_function',{NAME:'custom'})]),false);
assert.equal(load('raise RuntimeError("must not run during definition")'),true);
sources.push(vm.runInContext('generatePython()',context));
assert.equal(load('return arg','custom',[node('adv_python_function',{NAME:'custom',CODE:'pass'})]),false);
assert.equal(load('return 0','   '),false);
assert.equal(load('return 0\0'),false);
assert.throws(()=>load('x'.repeat(16385)));
assert.equal(load('#'+ 'x'.repeat(3000)),true,'larger than ordinary text input');
assert.equal(load('return 123','evil\nprint(999)'),true);
assert.ok(!vm.runInContext('generatePython()',context).includes('\nprint(999)'));
assert.equal(load('return 8','custom',[call]),true);
const raw=workspace.getAllBlocks(false).find(b=>b.type==='adv_python_function');
raw.unplug();assert.equal(vm.runInContext('validateProgram()',context),false);
assert.ok(Exchange.prompt('pico',profiles.pico,schema).includes('adv_python_function'));
workspace.dispose();
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(sources));
else console.log('PASS: Python body field, calls, imports, duplicate names, size limits, placement, serialization and language changes');
