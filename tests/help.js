const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const html = fs.readFileSync('index.html','utf8');
const app = fs.readFileSync('app.js','utf8');
const storage = new Map();
function load() {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const $ = selector => document.querySelector(selector);
  const dialog = $('#helpDialog');
  dialog.showModal = () => {dialog.open = true;};
  dialog.close = () => {dialog.open = false;};
  let scrolled = false;
  $('#firmwareHelp').scrollIntoView = () => {scrolled = true;};
  const context = vm.createContext({$,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},setMenuOpen:()=>{}});
  vm.runInContext(app.slice(app.indexOf('  const helpDialog ='),app.indexOf('  const exchangeDialog =')),context);
  return {$,dom,scrolled:()=>scrolled};
}
let page=load(), $=page.$;
assert.equal($('#firstRunGuide').hidden,false);
const ids=[...page.dom.window.document.querySelectorAll('[id]')].map(e=>e.id);
assert.equal(ids.length,new Set(ids).size);
for(const id of ['jogHelp','wifiHelp','scsHelp','boardPinHint']) assert.ok($('#helpDialog').contains($('#'+id)));
assert.ok(!page.dom.window.document.querySelector('.side-panel #jogHelp'));
$('#dismissFirstRun').click();
assert.ok($('#firstRunGuide').hidden);
assert.equal(storage.size,0); // Temporary close is not remembered.
page=load(); $=page.$;
assert.equal($('#firstRunGuide').hidden,false);
$('#hideFirstRun').click();
assert.ok($('#firstRunGuide').hidden);
page=load(); $=page.$;
assert.ok($('#firstRunGuide').hidden); // Checkbox preference survives reload.
$('#helpMenuItem').click();
assert.ok($('#helpDialog').open);
$('#showFirstRun').click();
assert.equal($('#helpDialog').open,false);
assert.equal($('#firstRunGuide').hidden,false);
assert.equal($('#hideFirstRun').checked,false);
$('#showFirmwareSteps').click();
assert.ok($('#firstRunGuide').hidden && $('#firmwareHelp').open && page.scrolled());
$('#helpMenuItem').click(); $('#helpClose').click();
assert.equal($('#helpDialog').open,false);
assert.ok(app.includes('exchangeDialog.open || helpDialog.open || !firstRunGuide.hidden'));
console.log('PASS: concise sidebar, HELP location, unique IDs, dismiss/remember/reload/reopen and firmware navigation');
