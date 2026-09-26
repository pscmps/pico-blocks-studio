// Exercise real app actions with a simulated serial peer; no USB device is opened.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const app = fs.readFileSync('app.js','utf8');
const calls=[];
const context=vm.createContext({PicoWifi:{selected:()=>false},PicoBoot:require('../boot.js'),TextEncoder,port:{},isBusy:false,controllerActive:false,serialBuffer:'',
  t: (value,...args)=>typeof value==='string'?value:String.raw({raw:value},...args),
  validateProgram:()=>true,getUartControllerBlock:()=>null,generatePython:()=> 'while True:\n    pass\n',
  updateControllerConnection:()=>{},showTab:()=>{},showToast:message=>calls.push(['toast',message]),appendConsole:()=>{},
  setBusy:busy=>{context.isBusy=busy;},setBoardMode:mode=>calls.push(['mode',mode]),
  enterRawRepl:async()=>calls.push(['raw']),writeSource:async code=>calls.push(['source',code]),
  executeRaw:async code=>{calls.push(['save',code]);context.serialBuffer='PICOBLOCKS_SAVED';},
  writeControl:async(...bytes)=>{calls.push(['control',...bytes]);context.serialBuffer=bytes.join(',')==='2,4'?'PICOBLOCKS_MODE '+context.bootResult+'\nPICOBLOCKS_READY':'OK';},
  waitFor:async(pattern)=>{calls.push(['wait',pattern]);assert.ok(context.serialBuffer.includes(pattern));},
  bootResult:'RUN',
});
vm.runInContext(app.slice(app.indexOf('  function bytesLiteral'),app.indexOf('  async function connect()')),context);
vm.runInContext(app.slice(app.indexOf('  async function runProgram'),app.indexOf('  function showTab')),context);
(async()=>{
  await vm.runInContext('runProgram()',context);
  assert.ok(calls.some(([action,pattern])=>action==='wait'&&pattern==='OK'));
  assert.ok(!calls.some(([action])=>action==='save'));
  assert.equal(context.isBusy,false); // Infinite program does not block the UI.
  calls.length=0;
  await vm.runInContext('saveProgram()',context);
  assert.ok(calls.some(([action,code])=>action==='save'&&code.includes('os.rename')&&code.includes('PICOBLOCKS_BOOT_WINDOW')));
  assert.ok(calls.some(call=>call.join(',')==='control,2,4'));
  assert.ok(calls.some(([action,pattern])=>action==='wait'&&pattern==='PICOBLOCKS_MODE '));
  assert.equal(context.controllerActive,false);
  context.getUartControllerBlock=()=>({type:'wifi_jog_setup'});
  calls.length=0;
  await vm.runInContext('saveProgram()',context);
  assert.ok(context.controllerActive);
  assert.ok(calls.some(([action,pattern])=>action==='wait'&&pattern==='PICOBLOCKS_READY'));
  context.bootResult='WRITE'; calls.length=0;
  await vm.runInContext('saveProgram()',context);
  assert.equal(context.controllerActive,false);
  assert.ok(!calls.some(([action,pattern])=>action==='wait'&&pattern==='PICOBLOCKS_READY'));
  calls.length=0;
  await vm.runInContext('enterWriteMode()',context);
  assert.deepEqual(calls.filter(([action])=>action==='control'),[['control',2]]);
  assert.ok(calls.some(([action])=>action==='raw'));
  assert.ok(!calls.some(([action])=>action==='save')); // Saved file remains untouched.
  assert.ok(calls.some(call=>call.join(',')==='mode,WRITE'));
  calls.length=0;
  context.isBusy=true;
  await vm.runInContext('enterWriteMode()',context);
  await vm.runInContext('stopProgram()',context);
  await vm.runInContext('saveProgram()',context);
  assert.equal(calls.length,0); // No interleaved writes while transferring a file.
  context.isBusy=false;
  context.executeRaw=async()=>{throw Error('write failed');};
  await vm.runInContext('saveProgram()',context);
  assert.ok(!calls.some(call=>call.join(',')==='control,2,4')); // No reboot on failed save.
  console.log('PASS: mode transitions, nonblocking run, boot wait, Wi-Fi ready, failed save, transfer lock');
})().catch(error=>{console.error(error);process.exitCode=1;});
