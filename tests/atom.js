// Generated ESP32 code and board integration; never opens a hardware port.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Servo = require('../servo.js'), Boot = require('../boot.js');
const app = fs.readFileSync('app.js', 'utf8');
const context = vm.createContext({ServoBlocks:Servo, PicoJog:require('../jog.js'), BasicBlocks:require('../basic.js'), GeekDisplay:require('../display.js'),
  localStorage:{getItem:()=> 'atom_lite'}, encoder:new TextEncoder(), showToast:()=>{}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  function pyString'),app.indexOf('  const PICO_LEFT_PINS')),context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'),app.indexOf('  function getUartControllerConfig')),context);
const block=(type,fields={})=>({type,getFieldValue:n=>String(fields[n]??''),getNextBlock:()=>null,getInputTargetBlock:()=>null});
const sources=[];
function generate(blocks) {
  const start=block('program_start');
  [start,...blocks].forEach((b,i)=>b.getNextBlock=()=>blocks[i]||null);
  context.workspace={getTopBlocks:()=>[start],getAllBlocks:()=>[start,...blocks]};
  assert.ok(vm.runInContext('validateProgram()',context));
  const code=vm.runInContext('generatePython()',context);
  assert.ok(!/import rp2|asm_pio|StateMachine|BOOTSEL/.test(code));
  sources.push(code);return code;
}
const profile=vm.runInContext('BOARD_PROFILES.atom_lite',context);
assert.equal(profile.platform,'esp32'); assert.equal(profile.wifi,true);
assert.match(profile.name,/開発中.*動作未確認/);
assert.equal(profile.firmwareUrl,'https://micropython.org/download/ESP32_GENERIC/');
assert.deepEqual(Array.from(profile.pins),[19,21,22,23,25,26,32,33]);
assert.deepEqual(Array.from(vm.runInContext('adcOptions()',context),p=>p[1]),['32','33']);
const setup=model=>block(model+'_setup',{PIN:26,BAUD:1000000});
for(const model of ['scs009','xl330','sts3215','sts3235']) {
  const code=generate([setup(model),block(model+'_torque',{ID:1,STATE:0})]);
  assert.match(code,/class ServoBus:/); assert.match(code,/Pin.OPEN_DRAIN/);
}
const mixed=generate([setup('scs009'),block('sts3215_setup',{PIN:32,BAUD:1000000})]);
assert.equal((mixed.match(/class ServoBus:/g)||[]).length,1);
assert.match(mixed,/ServoBus\(32, 1000000, 2\)/);
const two=generate([setup('xl330'),block('sts3235_setup',{PIN:32,BAUD:1000000})]);
assert.match(two,/ServoBus\(26, 1000000, 1\)/);
assert.match(two,/ServoBus\(32, 1000000, 2\)/);
const wifi=block('wifi_jog_setup',{SSID:'test-atom',PASSWORD:'not-a-secret'});
const jog=generate([setup('scs009'),wifi,block('uart_controller_setup')]);
assert.match(jog,/network.WLAN/); assert.match(jog,/_controller_usb_poll/);
assert.match(jog,/scs009.move/);
generate([block('pwm_setup',{PIN:19,CHANNEL:1,MIN_US:1000,MAX_US:2000}),block('pwm_bind',{ID:1,AXIS:'Y',CENTER:90,STEP:2}),wifi]);
const led=generate([block('pico_led',{STATE:'1'})]);
assert.match(led,/neopixel.NeoPixel/);
const adc=require('../basic.js').runtime([block('basic_adc',{PIN:32})],profile);
assert.match(adc,/_adc_32.atten\(ADC.ATTN_11DB\)/);
for(const blocks of [[setup('scs009'),block('xl330_setup',{PIN:19}),block('sts3215_setup',{PIN:32})],
  [block('basic_adc',{PIN:26})],[block('scs009_setup',{PIN:1})],
  [setup('scs009'),block('basic_write',{PIN:26})],[block('lcd_print')]]) {
  context.workspace={getAllBlocks:()=>blocks};assert.equal(vm.runInContext('validateProgram()',context),false);
}
const gate=Boot.wrap('events.append("app")','atom_lite');
assert.match(gate,/Pin\(39, Pin.IN\)/);assert.ok(!gate.includes('rp2'));
global.PicoBoot=Boot;
const bytes=s=>"b'"+[...Buffer.from(s)].map(n=>'\\x'+n.toString(16).padStart(2,'0')).join('')+"'";
const install=require('../wifi.js').installCommand('receiver', {board:'atom_lite',key:'ab'.repeat(32)},'pass',bytes);
assert.match(install,/sys.platform != 'esp32'/);assert.match(install,/endswith\('with ESP32'\)/);
assert.ok(!Boot.saveCommand('pass',bytes,'atom_lite').includes('rp2'));
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify({sources,bus:Servo.ESP32_BUS_DRIVER,led:Servo.ESP32_LED_DRIVER,scs:Servo.espScsDriver(vm.runInContext('SCS009_DRIVER',context)),gate,install,adc}));
else console.log('PASS: ATOM board/pins, all serial protocols, UART allocation, USB/Wi-Fi JOG, RGB/ADC, validation, boot gate and Wi-Fi installer');
