const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const {webcrypto} = require('node:crypto');
globalThis.crypto = webcrypto;
globalThis.PicoBoot = require('../boot.js');
const Wifi = require('../wifi.js');
const key = 'ab'.repeat(32), ticket = 'cd'.repeat(16);
const html = fs.readFileSync('index.html','utf8');
const app = fs.readFileSync('app.js','utf8');
const t = (v,...args) => typeof v === 'string' ? v : String.raw({raw:v},...args);

async function main() {
  for (const host of ['192.168.1.4','http://10.0.0.4/','172.16.2.4','pico.local']) assert.ok(Wifi.address(host).startsWith('http://'));
  for (const host of ['https://192.168.1.4','https://evil.com','evil.com','127.0.0.1','192.168.1.4@evil.com','192.168.1.4:8080','192.168.1.4/x','192.168.1.4#x','172.32.0.1','192.168.999.1']) assert.throws(() => Wifi.address(host),host);
  assert.throws(()=>new Wifi.Client('192.168.1.4','short','picow'));
  const calls=[], pieces=[]; let saved=false;
  const peer = async (url, options) => {
    const path = new URL(url).pathname;
    assert.equal(options.redirect,'error'); assert.equal(options.credentials,'omit');
    assert.equal(options.headers['X-PicoBlocks-Key'],key);
    calls.push(path);
    const data=options.body ? JSON.parse(options.body) : null;
    let result;
    if(path==='/status')result={protocol:1,board:'picow',mode:'WRITE',max:131072};
    if(path==='/begin'){assert.equal(data.sha256.length,64);result={ticket};}
    if(path==='/chunk') {assert.equal(data.ticket,ticket);const p=Buffer.from(data.data,'base64');assert.ok(p.length<=768);pieces.push(p);result={offset:data.offset+p.length};}
    if(path==='/commit'){saved=true;result={saved:true};}
    return {ok:true,status:200,json:async()=>result};
  };
  const client=new Wifi.Client('192.168.1.4',key,'picow',peer), progress=[];
  const source=PicoBoot.wrap('print("日本語☀")\n'.repeat(100));
  await client.upload(source,n=>progress.push(n));
  assert.ok(saved); assert.equal(progress.at(-1),100);
  assert.equal(Buffer.concat(pieces).toString('utf8'),source);
  assert.ok(!calls.includes('/run'),'Upload itself never runs before commit is confirmed');
  await assert.rejects(new Wifi.Client('192.168.1.4',key,'pico2w',peer).status());
  const before=calls.length; await assert.rejects(client.upload('x'.repeat(131073))); assert.equal(calls.length,before);
  for(const badPath of ['/begin','/chunk','/commit']) {
    calls.length=0;
    const broken=new Wifi.Client('192.168.1.4',key,'picow',async(url,options)=>{
      if(new URL(url).pathname===badPath)throw new TypeError('network lost');
      return peer(url,options);
    });
    await assert.rejects(broken.upload(source));
    assert.ok(!calls.includes('/run'));
    if(badPath!=='/commit')assert.ok(!calls.includes('/commit'));
  }
  await assert.rejects(new Wifi.Client('192.168.1.4',key,'picow',async()=>({status:401})).status());
  await assert.rejects(new Wifi.Client('192.168.1.4',key,'picow',async(url,options)=>{
    if(url.endsWith('/chunk'))return {ok:true,status:200,json:async()=>({offset:1})};
    return peer(url,options);
  }).upload(source));

  // Real UI module, mocked network only. Defaults stay USB on all boards.
  const dom=new JSDOM(html,{url:'https://pscmps.github.io/pico-blocks-studio/'}), d=dom.window.document;
  const $=id=>d.querySelector(id);
  $('#wifiDialog').showModal=()=>{$('#wifiDialog').open=true;};
  $('#wifiDialog').close=()=>{$('#wifiDialog').open=false;};
  const context=vm.createContext({document:d,localStorage:dom.window.localStorage,TextEncoder,Uint8Array,URL,AbortController,setTimeout,clearTimeout,btoa,crypto:webcrypto,fetch:peer,PicoBoot});
  vm.runInContext(fs.readFileSync('wifi.js','utf8')+'\nglobalThis.wifi = PicoWifi;',context);
  const wifi=context.wifi;
  let busy=false;
  const callbacks={changed:()=>{},mode:()=>{},toast:()=>{},closeMenu:()=>{},hasUSB:()=>false,
    busy:value=>{busy=value;wifi.setBusy(value);},progress:()=>{},install:()=>{throw Error('must not install');}};
  wifi.init(callbacks); wifi.configure('pico',false);
  assert.ok($('#wifiTransport').hidden); assert.equal($('#transportSelect').value,'usb');
  wifi.configure('picow',true); assert.ok(!$('#wifiTransport').hidden);
  $('#wifiInstall').click(); assert.ok($('#wifiStatus').textContent.includes('USB'));
  $('#transportSelect').value='wifi'; $('#transportSelect').dispatchEvent(new dom.window.Event('change'));
  assert.ok($('#wifiDialog').open);
  $('#wifiHost').value='192.168.1.4';$('#wifiKey').value=key;
  $('#wifiCheck').click(); await new Promise(r=>setTimeout(r,5));
  assert.ok(wifi.connected()); assert.ok(!busy);
  assert.equal(dom.window.localStorage.getItem('picoblocks-wifi-v1'),null,'No unrequested credential persistence');
  $('#wifiRemember').checked=true; $('#wifiRemember').dispatchEvent(new dom.window.Event('change'));
  assert.equal(JSON.parse(dom.window.localStorage.getItem('picoblocks-wifi-v1')).key,key);
  $('#wifiKey').dispatchEvent(new dom.window.Event('input')); assert.ok(!wifi.connected());
  wifi.configure('pico2',false); assert.equal($('#transportSelect').value,'usb');
  assert.ok(!wifi.selected());

  // The actual Save button dispatches Wi-Fi without touching Web Serial.
  const modes=vm.createContext({PicoWifi:{selected:()=>true,upload:async code=>assert.equal(code,'generated')},
    isBusy:false,validateProgram:()=>true,generatePython:()=> 'generated'});
  vm.runInContext(app.slice(app.indexOf('  async function saveProgram'),app.indexOf('  async function stopProgram')),modes);
  await vm.runInContext('saveProgram()',modes);
  modes.isBusy=true; await vm.runInContext('saveProgram()',modes);

  // Real button state: no Wi-Fi temporary run/stop and no dependency on a USB port.
  const state=vm.createContext({PicoWifi:{selected:()=>true,connected:()=>true},isBusy:false,port:null,t,
    elements:Object.fromEntries(Object.entries({connectionState:'connectionState',connectionLabel:'connectionLabel',run:'runButton',save:'saveButton',writeMode:'writeModeButton',stop:'stopButton',connect:'connectButton',actionHint:'actionHint'}).map(([key,id])=>[key,$('#'+id)]))});
  vm.runInContext(app.slice(app.indexOf('  function setConnection('),app.indexOf('  function setBusy(')),state);
  vm.runInContext('setConnection("offline", "offline")',state);
  assert.ok(!$('#saveButton').disabled);assert.ok($('#runButton').disabled&&$('#stopButton').disabled&&$('#writeModeButton').disabled);
  console.log('PASS: direct Wi-Fi transfer, Unicode/chunks/hash, failure paths, limits, auth, origin-safe URLs, board match, UI setup/storage/transport and USB-independent Save');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
