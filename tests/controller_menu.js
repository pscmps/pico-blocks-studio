const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Blockly=require('blockly'),{JSDOM}=require('jsdom');
const app=fs.readFileSync('app.js','utf8'),document=new JSDOM(fs.readFileSync('index.html','utf8')).window.document;
const workspace=new Blockly.Workspace(),$=s=>document.querySelector(s);
const context=vm.createContext({Blockly,workspace,$,document,encoder:new TextEncoder(),localStorage:{getItem:()=> 'pico2w'},
  ServoBlocks:require('../servo.js'),PicoJog:require('../jog.js'),BasicBlocks:require('../basic.js'),GeekDisplay:require('../display.js')});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  const theme'),app.indexOf('  const workspace')),context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'),app.indexOf('  function validateProgram')),context);
context.elements={};
for(const [name,id] of Object.entries({controllerMenuItem:'controllerMenuItem',run:'runButton',controllerDrawer:'controllerDrawer',
  controllerPortSummary:'controllerPortSummary',appMenu:'appMenu',menuButton:'menuButton',controllerConnectionLabel:'controllerConnectionLabel',
  controllerConnect:'controllerConnectButton',jogCenter:'jogCenterButton'}))context.elements[name]=$('#'+id);
context.port=null;context.isBusy=false;context.controllerActive=false;context.controllerConfigSignature='';
context.controllerAxes={};context.controllerValues={};
vm.runInContext(app.slice(app.indexOf('  function getUartControllerConfig'),app.indexOf('  async function connectController')),context);
for(const board of ['pico','pico2w','picow','atom_lite','pico2','rp2040_geek','rp2350_geek','xiao_rp2040','xiao_rp2350']) {
  context.board=board;vm.runInContext('selectedBoard=board',context);
  workspace.clear();workspace.newBlock('wifi_jog_setup');
  vm.runInContext('updateControllerConnection()',context);
  assert.equal(context.elements.controllerMenuItem.disabled,false,`${board}: Wi-Fi block must keep menu accessible`);
  vm.runInContext('openController()',context);
  assert.equal(context.elements.controllerDrawer.getAttribute('aria-hidden'),'false');
  const supported=['pico2w','picow','atom_lite'].includes(board);
  assert.equal($('#controllerSetupHint').hidden,supported);
  assert.equal(context.elements.controllerConnect.disabled,!supported);
  assert.equal(context.elements.jogCenter.disabled,true,'no JOG output before starting');
}
context.board='pico2w';vm.runInContext('selectedBoard=board',context);
workspace.clear();vm.runInContext('updateControllerUi()',context);assert.equal(context.elements.controllerMenuItem.disabled,true);
workspace.newBlock('wifi_jog_setup');
// Opening the menu recovers stale state even if no Blockly event has arrived.
vm.runInContext('setMenuOpen(true)',context);assert.equal(context.elements.controllerMenuItem.disabled,false);
assert.equal(context.elements.controllerConnect.disabled,false);
const saved=Blockly.serialization.workspaces.save(workspace);workspace.clear();Blockly.serialization.workspaces.load(saved,workspace);
vm.runInContext('updateControllerUi()',context);assert.equal(context.elements.controllerMenuItem.disabled,false);
context.isBusy=true;vm.runInContext('updateControllerConnection()',context);
assert.equal(context.elements.controllerMenuItem.disabled,false);assert.equal(context.elements.controllerConnect.disabled,true);
context.isBusy=false;context.port={};context.controllerActive=true;vm.runInContext('updateControllerConnection()',context);
assert.equal(context.elements.jogCenter.disabled,false);
context.board='pico';vm.runInContext('selectedBoard=board;updateControllerUi()',context);
assert.equal(context.elements.jogCenter.disabled,true);assert.equal(context.elements.controllerConnect.disabled,false,'stop stays available');
context.controllerActive=false;workspace.clear();workspace.newBlock('uart_controller_setup');vm.runInContext('updateControllerConnection()',context);
assert.equal(context.elements.controllerMenuItem.disabled,false);assert.equal($('#controllerSetupHint').hidden,true);
workspace.clear();vm.runInContext('setMenuOpen(true)',context);assert.equal(context.elements.controllerMenuItem.disabled,true);
assert.equal(context.elements.controllerDrawer.getAttribute('aria-hidden'),'true');
// Motor commands remain blocked for a mismatched board, but stopping must work
// even when the edited workspace fails validation.
vm.runInContext(app.slice(app.indexOf('  async function connectController'),app.indexOf('  function setConnection')),context);
const sent=[];let stopped=0;
context.writeBytes=async command=>sent.push(command);context.stopProgram=async()=>{stopped++;};context.validateProgram=()=>false;
(async()=>{
  context.controllerActive=true;context.port={};
  workspace.newBlock('wifi_jog_setup');
  await vm.runInContext('sendJogCommand("CENTER\\n")',context);assert.equal(sent.length,0);
  await vm.runInContext('connectController()',context);assert.equal(stopped,1);assert.equal(context.controllerActive,false);
  context.board='pico2w';vm.runInContext('selectedBoard=board',context);context.controllerActive=true;
  await vm.runInContext('sendJogCommand("DELTA X 1\\n")',context);assert.equal(sent.length,1);
  workspace.clear();await vm.runInContext('sendJogCommand("CENTER\\n")',context);assert.equal(sent.length,1);
  workspace.dispose();
  console.log('PASS: controller menu, Wi-Fi-only, board mismatch, stale state, restore, busy, motor guards and stop controls');
})().catch(error=>{console.error(error);process.exitCode=1;});
