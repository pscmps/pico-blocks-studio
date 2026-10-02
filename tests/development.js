const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),Blockly=require('blockly');
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
const storage=new Map(),key='picoblocks-show-development-v1';
function create() {
  const document=new JSDOM(html).window.document,$=s=>document.querySelector(s),workspace=new Blockly.Workspace();
  let toolbox;
  workspace.updateToolbox=value=>{toolbox=value;};workspace.getToolbox=()=>null;workspace.getFlyout=()=>null;
  const context=vm.createContext({Blockly,document,$,workspace,BasicBlocks:require('../basic.js'),ServoBlocks:require('../servo.js'),GeekDisplay:require('../display.js'),PicoJog:require('../jog.js'),
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},isBusy:false,controllerActive:false,sampleDialog:{open:false},showToast:()=>{},
    updateControllerUi:()=>{},encoder:new TextEncoder(),backupKey:'backup'});
  vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
  const warn=console.warn;console.warn=()=>{};
  try{vm.runInContext(app.slice(app.indexOf('  const theme'),app.indexOf('  const workspace')),context);}finally{console.warn=warn;}
  vm.runInContext(app.slice(app.indexOf('  function updateDevelopmentUi()'),app.indexOf('  function setWiringCollapsed')),context);
  vm.runInContext(app.slice(app.indexOf('  function validateProgram('),app.indexOf('  function getUartControllerConfig')),context);
  vm.runInContext(app.slice(app.indexOf('  function replaceFromExchange('),app.indexOf('  $("#importBlocks").addEventListener')),context);
  context.updateBoardUi=()=>vm.runInContext('updateDevelopmentUi()',context);
  context.updateBoardUi();
  const toggle=checked=>{context.event={target:$('#showDevelopment')};context.event.target.checked=checked;vm.runInContext('changeDevelopmentVisibility(event)',context);};
  const select=board=>{context.board=board;vm.runInContext('selectedBoard=board',context);context.updateBoardUi();};
  return {context,workspace,$,toggle,select,toolbox:()=>toolbox};
}
let p=create();
const count=(p,id)=>p.$('#'+id).querySelectorAll('option[value^="shield_"]').length;
assert.equal(p.$('#showDevelopment').checked,false);
assert.equal(count(p,'boardSelect'),0);assert.equal(count(p,'gcodeSampleBoard'),0);
assert.ok(p.$('#shieldHelpContent').hidden);
assert.ok(p.$('#boardSelect option[value="atom_lite"]'),'Existing ATOM visibility is unchanged');
p.toggle(true);
assert.equal(storage.get(key),'1');assert.equal(count(p,'boardSelect'),6);assert.equal(count(p,'gcodeSampleBoard'),6);
assert.equal(p.$('#shieldHelpContent').hidden,false);
p.select('shield_touch2');p.$('#gcodeSampleBoard').value='shield_touch2';
const start=p.workspace.newBlock('program_start'),preset=p.workspace.newBlock('gcode_shield');preset.setFieldValue('touch2','CARRIER');start.nextConnection.connect(preset.previousConnection);
const state=JSON.stringify(Blockly.serialization.workspaces.save(p.workspace));
p.toggle(false);
assert.equal(count(p,'boardSelect'),0);assert.equal(count(p,'gcodeSampleBoard'),0);
assert.equal(p.$('#boardSelect').value,'');assert.equal(p.$('#gcodeSampleBoard').value,'pico2');
assert.equal(vm.runInContext('selectedBoard',p.context),'shield_touch2','Never silently replace the controller');
assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(p.workspace)),state,'OFF preserves blocks');
assert.ok(!JSON.stringify(p.toolbox()).includes('gcode_shield'));
assert.equal(vm.runInContext('validateProgram()',p.context),false);
assert.throws(()=>vm.runInContext('validateProgram({throwOnError:true})',p.context),/HELP/);
assert.throws(()=>vm.runInContext("replaceFromExchange({board:'shield_pico'},true)",p.context),/HELP/,'Restoring a hidden board also requires opt-in');
p.toggle(true);assert.equal(p.$('#boardSelect').value,'shield_touch2');assert.ok(JSON.stringify(p.toolbox()).includes('gcode_shield'));
assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(p.workspace)),state);
p.context.isBusy=true;p.toggle(false);assert.equal(p.$('#showDevelopment').checked,true);assert.equal(storage.get(key),'1');
p.context.isBusy=false;p.context.controllerActive=true;p.toggle(false);assert.equal(storage.get(key),'1');
p.workspace.dispose();
storage.set('picoblocks-board-v1','shield_touch2');p=create();assert.equal(p.$('#showDevelopment').checked,true);assert.equal(count(p,'boardSelect'),6);
p.toggle(false);p.workspace.dispose();p=create();assert.equal(count(p,'boardSelect'),0);assert.equal(p.$('#boardSelect').value,'');
p.toggle(true);assert.equal(p.$('#boardSelect').value,'shield_touch2');p.workspace.dispose();
console.log('PASS: development opt-in defaults, six board/sample options, persistence, hidden saved board, toolbox, import/run guards, busy guards and workspace preservation');
