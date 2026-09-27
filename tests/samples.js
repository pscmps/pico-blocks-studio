const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Blockly=require('blockly'),Basic=require('../basic.js'),Exchange=require('../exchange.js'),Samples=require('../samples.js'),Jog=require('../jog.js');
const app=fs.readFileSync('app.js','utf8'),workspace=new Blockly.Workspace();
const context=vm.createContext({Blockly,BasicBlocks:Basic,ServoBlocks:require('../servo.js'),PicoJog:Jog,GeekDisplay:require('../display.js'),workspace,localStorage:{getItem:()=> 'pico'},encoder:new TextEncoder(),showToast:()=>{}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  const theme'),app.indexOf('  const workspace')),context);
vm.runInContext(app.slice(app.indexOf('  function pyString'),app.indexOf('  const PICO_LEFT_PINS')),context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'),app.indexOf('  function getUartControllerConfig')),context);
const profiles=vm.runInContext('BOARD_PROFILES',context),programs=[],jogs=[];
function catalog(board) {
  context.board=board;vm.runInContext('selectedBoard=board',context);
  return Exchange.catalog(Blockly,vm.runInContext('buildToolbox()',context));
}
for(const [board,profile] of Object.entries(profiles)) {
  const schema=catalog(board);
  for(const model of Samples.models) for(const transport of ['usb','wifi']) {
    if(transport==='wifi'&&!profile.wifi) {
      assert.throws(()=>Samples.create(board,profile,model,transport)); continue;
    }
    const json=Samples.create(board,profile,model,transport);
    const parsed=Exchange.parse(JSON.stringify(json),profiles,()=>schema);
    Blockly.serialization.workspaces.load(parsed.workspace,workspace);
    assert.equal(workspace.getAllBlocks(false).length,parsed.count);
    assert.equal(workspace.getTopBlocks(false).length,1);
    assert.equal(vm.runInContext('validateProgram()',context),true,`${board}/${model}/${transport}`);
    const blocks=workspace.getAllBlocks(false);
    assert.equal(blocks.filter(b=>b.type===model+'_setup').length,model==='pwm'?3:1);
    assert.equal(blocks.filter(b=>b.type==='wifi_jog_setup').length,transport==='wifi'?1:0);
    assert.equal(blocks.some(b=>b.type.startsWith('lcd_')),board.endsWith('_geek'));
    assert.equal(blocks.filter(b=>b.type===model+'_torque').length,model==='pwm'?0:3);
    assert.ok(!blocks.some(b=>b.type.endsWith('_move')||b.type.endsWith('_pulse')),'no startup position command');
    const config=JSON.parse(JSON.stringify(vm.runInContext('getJogAxes()',context)));
    for(const [i,axis] of ['Y','X','Z'].entries()) {
      assert.equal(config[axis].id,i+1); assert.equal(config[axis].target,model);
    }
    assert.equal(config.R.id,null,'no phantom fourth servo');
    const code=vm.runInContext('generatePython()',context);
    assert.ok(code.includes('_controller_poll()'));assert.equal(code.includes('import network'),transport==='wifi');
    programs.push({board,model,transport,code});jogs.push({model,config,code:Jog.runtime(config,null)});
  }
}
// Preserve implicit four-servo SCS mapping for legacy programs without binds.
catalog('pico');workspace.clear();workspace.newBlock('scs009_setup');workspace.newBlock('uart_controller_setup');
assert.equal(vm.runInContext('getJogAxes().R.id',context),4);
assert.throws(()=>Samples.create('pico',profiles.pico,'unknown','usb'));
assert.throws(()=>Samples.create('pico',profiles.pico,'pwm','unknown'));
assert.equal(programs.length,60);
const html=fs.readFileSync('index.html','utf8');
for(const id of ['samplesMenuItem','sampleDialog','sampleModel','sampleTransport','loadSample','restoreSample']) assert.ok(html.includes(`id="${id}"`));
// Exercise the real UI handlers and transactional replacement with a DOM shell.
const {JSDOM}=require('jsdom'),dom=new JSDOM(html),$=selector=>dom.window.document.querySelector(selector),storage=new Map();
$('#sampleDialog').showModal=()=>{$('#sampleDialog').open=true;};
$('#sampleDialog').close=()=>{$('#sampleDialog').open=false;};
workspace.updateToolbox=()=>{};
context.$=$;context.PicoSamples=Samples;context.BlockExchange=Exchange;
context.Blockly={...Blockly,svgResize:()=>{}};
context.localStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
context.elements={pythonCode:$('#pythonCode')};context.normalizeWorkspace=()=>{};
context.updateBoardUi=()=>{};context.updateControllerUi=()=>{};context.setMenuOpen=()=>{};
context.boardCatalog=catalog;context.isBusy=false;context.controllerActive=false;context.backupKey='chat-backup';
vm.runInContext(app.slice(app.indexOf('  function replaceFromExchange'),app.indexOf('  $("#importBlocks").addEventListener')),context);
vm.runInContext(app.slice(app.indexOf('  const sampleDialog ='),app.indexOf('  $("#restoreImport").addEventListener')),context);
workspace.clear();workspace.newBlock('program_start');
const original=JSON.stringify(Blockly.serialization.workspaces.save(workspace));
$('#samplesMenuItem').click();assert.ok($('#sampleDialog').open);
assert.ok($('#sampleTransport option[value=wifi]').disabled);
$('#sampleModel').value='scs009';$('#loadSample').click();
assert.equal($('#sampleStatus').dataset.error,'false',$('#sampleStatus').textContent);assert.equal(vm.runInContext('getJogAxes().R.id',context),null);
assert.equal(JSON.stringify(JSON.parse(storage.get('picoblocks-sample-backup-v1')).workspace),original);
assert.ok(!storage.has('chat-backup'));
$('#restoreSample').click();assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(workspace)),original);
context.isBusy=true;$('#loadSample').click();assert.equal($('#sampleStatus').dataset.error,'true');
assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(workspace)),original);context.isBusy=false;
context.controllerActive=true;$('#loadSample').click();assert.equal($('#sampleStatus').dataset.error,'true');context.controllerActive=false;
context.board='pico2w';vm.runInContext('selectedBoard=board',context);$('#samplesMenuItem').click();
assert.equal($('#sampleTransport option[value=wifi]').disabled,false);
$('#sampleTransport').value='wifi';$('#sampleTransport').dispatchEvent(new dom.window.Event('change'));
assert.equal($('#sampleWifiSteps').hidden,false);$('#loadSample').click();
assert.equal($('#sampleStatus').dataset.error,'false',$('#sampleStatus').textContent);assert.ok(workspace.getAllBlocks(false).some(b=>b.type==='wifi_jog_setup'));
$('#restoreSample').click();assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(workspace)),original);
assert.ok(app.includes('|| sampleDialog.open) return;'),'modal suppresses motor keyboard commands');
workspace.dispose();
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify({programs,jogs}));
else console.log(`PASS: ${programs.length} samples across 9 boards; 3-servo mapping, Wi-Fi gates, LCD and legacy compatibility`);
