const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('acorn');
const {JSDOM} = require('jsdom');
const Blockly = require('blockly');
const I18n = require('../i18n.js');
const en = I18n.english;
const storage = new Map();
const freshLocale = () => {
  const page = vm.createContext({PicoEnglish:en,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
  vm.runInContext(fs.readFileSync('i18n.js','utf8'),page);
  return page.PicoI18n;
};
assert.equal(freshLocale().language,'ja');
freshLocale().setLanguage('en');
assert.equal(freshLocale().language,'en');
freshLocale().setLanguage('ja');
assert.equal(freshLocale().language,'ja');
const ja = /[\u3040-\u30ff\u3400-\u9fff]/;
const placeholders = text => [...text.matchAll(/%\d+|\{\d+\}/g)].map(m=>m[0]).sort();
for (const [source, translation] of Object.entries(en)) {
  assert.ok(!ja.test(translation), 'Untranslated: '+source);
  assert.deepEqual(placeholders(translation), placeholders(source), 'Placeholders: '+source);
}
// Every Japanese source literal is intentionally wrapped; every key is covered.
for (const file of ['app.js','basic.js','servo.js','display.js','wiring.js','exchange.js','jog.js']) {
  const source=fs.readFileSync(file,'utf8');
  function walk(node,parent) {
    if(!node || typeof node!=='object') return;
    let key;
    if(node.type==='Literal' && typeof node.value==='string' && ja.test(node.value)) {
      key=node.value;
      assert.equal(parent?.callee?.name,'t',`${file}: literal not localized: ${key}`);
    }
    if(node.type==='TemplateLiteral' && node.quasis.some(q=>ja.test(q.value.cooked))) {
      key=node.quasis.map((q,i)=>q.value.cooked+(i<node.expressions.length?`{${i}}`:'')).join('');
      assert.equal(parent?.tag?.name,'t',`${file}: template not localized`);
    }
    if(key) assert.ok(Object.hasOwn(en,key),`${file}: missing translation: ${key}`);
    for(const value of Object.values(node)) if(Array.isArray(value)) value.forEach(child=>walk(child,node)); else if(value && typeof value==='object') walk(value,node);
  }
  walk(acorn.parse(source,{ecmaVersion:2022}));
}
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html), document=dom.window.document;
I18n.bindDocument(document);
const originalHelp=document.querySelector('#helpDialog').textContent;
const originalHeader=document.querySelector('h1').textContent;
document.querySelector('#importText').value='日本語のユーザーデータ {0}';
document.querySelector('#serialConsole').textContent='日本語の実機出力';
for(const lang of ['en','ja','en']) {
  I18n.setLanguage(lang); I18n.renderDocument(document);
  assert.equal(document.documentElement.lang,lang);
  assert.equal(document.querySelector('#languageSelect').value,lang);
  assert.equal(document.querySelector('#helpDialog').lastElementChild.textContent,'made by pscmps');
  assert.equal(document.querySelector('#importText').value,'日本語のユーザーデータ {0}');
  assert.equal(document.querySelector('#serialConsole').textContent,'日本語の実機出力');
  if(lang==='en') {
    assert.equal(document.querySelector('h1').textContent,'Build with blocks');
    const walker=document.createTreeWalker(document,4);
    while(walker.nextNode()) {
      const n=walker.currentNode;
      if(n.parentElement?.closest('script,style,#languageSelect,.language-choice,#serialConsole,textarea'))continue;
      assert.ok(!ja.test(n.nodeValue),'Untranslated DOM: '+n.nodeValue);
    }
    for(const el of document.querySelectorAll('*')) for(const attr of el.attributes) if(!attr.value.includes('Language /')) assert.ok(!ja.test(attr.value),'Untranslated attribute: '+attr.value);
    assert.ok(document.querySelector('#exchangeGuideLink').href.endsWith('AI_GUIDE.en.md'));
  } else {
    assert.equal(document.querySelector('#helpDialog').textContent,originalHelp);
    assert.equal(document.querySelector('h1').textContent,originalHeader);
  }
}
const app=fs.readFileSync('app.js','utf8');
const Basic=require('../basic.js'), Servo=require('../servo.js'), Display=require('../display.js'), Jog=require('../jog.js'), Exchange=require('../exchange.js');
const workspace=new Blockly.Workspace();
const context=vm.createContext({Blockly,PicoI18n:I18n,BasicBlocks:Basic,ServoBlocks:Servo,GeekDisplay:Display,PicoJog:Jog,workspace,
  localStorage:{getItem:()=> 'pico'},encoder:new TextEncoder(),showToast:()=>{}});
vm.runInContext(app.slice(app.indexOf('  const PICO_PINS'),app.indexOf('  const elements')),context);
vm.runInContext(app.slice(app.indexOf('  const theme'),app.indexOf('  const workspace')),context);
vm.runInContext(app.slice(app.indexOf('  function pyString'),app.indexOf('  const PICO_LEFT_PINS')),context);
vm.runInContext(app.slice(app.indexOf('  function getUartControllerBlock'),app.indexOf('  function getUartControllerConfig')),context);
const profiles=vm.runInContext('BOARD_PROFILES',context);
const sources=[];
const catalogs={};
for(const lang of ['ja','en','ja']) {
  I18n.setLanguage(lang);
  // Redefining registered block types is intentional on a locale switch.
  const warn=console.warn; console.warn=()=>{};
  try {vm.runInContext('Object.assign(BOARD_PROFILES,createBoardProfiles()); registerBlocks()',context);} finally {console.warn=warn;}
  catalogs[lang]={};
  for(const board of Object.keys(profiles)) {
    context.board=board; vm.runInContext('selectedBoard=board',context);
    const toolbox=vm.runInContext('buildToolbox()',context);
    const schema=Exchange.catalog(Blockly,toolbox);
    catalogs[lang][board]=schema;
    const prompt=Exchange.prompt(board,profiles[board],schema);
    if(lang==='en') {
      assert.ok(!ja.test(JSON.stringify(toolbox)),'Toolbox: '+board);
      assert.ok(!ja.test(JSON.stringify(schema)),'Catalog: '+board);
      assert.ok(!ja.test(prompt),'Prompt: '+board);
      assert.ok(prompt.includes('AI_GUIDE.en.md'));
    }
    const categories=toolbox.contents.map(c=>c.name);
    assert.ok(categories.indexOf(I18n.t('PWMサーボ'))<categories.indexOf('SCS009'));
    const state={blocks:{languageVersion:0,blocks:[{type:'program_start',next:{block:{type:'basic_print',inputs:{VALUE:{block:{type:'basic_text',fields:{TEXT:'日本語 {0} <not translated>'}}}}}}}]}};
    Blockly.serialization.workspaces.load(state,workspace);
    const before=JSON.stringify(Blockly.serialization.workspaces.save(workspace));
    const generated=vm.runInContext('generatePython()',context);
    assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(workspace)),before);
    assert.ok(generated.includes('日本語 {0} <not translated>'));
    sources.push(generated);
  }
  const mobile=Jog.mobilePage(Jog.defaults(true));
  const page=new JSDOM(mobile);
  acorn.parse(page.window.document.querySelector('script').textContent,{ecmaVersion:2022});
  assert.equal(page.window.document.documentElement.lang,lang);
  if(lang==='en')assert.ok(!ja.test(mobile));
}
// Localized labels and default variable names may differ; protocol identifiers do not.
for(const board of Object.keys(profiles)) {
  const strip = schema => JSON.parse(JSON.stringify(schema,(key,value)=>key==='label'||(key==='default'&&typeof value==='string'&&['値','value'].includes(value))?undefined:value));
  assert.deepEqual(strip(catalogs.en[board]),strip(catalogs.ja[board]));
}
I18n.setLanguage('en');
assert.throws(()=>Exchange.parse('bad',profiles,()=>({})),/Could not read JSON/);
assert.equal(I18n.t`選択中: ${'日本語 {0}'}`,'Selected: 日本語 {0}');
for (const file of ['AI_GUIDE.md','AI_GUIDE.en.md']) {
  for (const match of fs.readFileSync(file,'utf8').matchAll(/```json\s*([\s\S]*?)```/g)) {
    Exchange.parse(match[1],profiles,board=>catalogs.en[board]);
  }
}
// Exercise the real switch function with a connected, running controller.
// Any accidental device action would fail because no serial API is supplied.
const savedState=JSON.stringify(Blockly.serialization.workspaces.save(workspace));
const fakePort={connected:true}, fakeWriter={};
const noop=()=>{};
Object.assign(workspace,{scrollX:12,scrollY:34,scale:0.92,getInjectionDiv:()=>document.createElement('div'),
  updateToolbox:noop,getToolbox:()=>null,getFlyout:()=>null,setScale:noop,scroll:noop});
const fakeEvent={marker:'undo'}, fakeRedo={marker:'redo'};
workspace.getUndoStack().push(fakeEvent); workspace.getRedoStack().push(fakeRedo);
Object.assign(context,{$:selector=>document.querySelector(selector),document,isBusy:false,port:fakePort,writer:fakeWriter,
  controllerActive:true,boardMode:'RUN',normalizeWorkspace:noop,updateBoardUi:noop,setWiringCollapsed:noop,
  setBoardMode:noop,setConnection:noop,updateControllerConnection:noop,updateControllerUi:noop,refreshExchangePrompt:noop,
  elements:{appShell:document.querySelector('#appShell'),connect:document.querySelector('#connectButton'),pythonCode:document.querySelector('#pythonCode')},
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
vm.runInContext(app.slice(app.indexOf('  function changeLanguage('),app.indexOf('  $("#languageSelect").addEventListener')),context);
const oldResize=Blockly.svgResize, oldWarn=console.warn;
Blockly.svgResize=noop; console.warn=noop;
try {
  vm.runInContext('changeLanguage("ja")',context);
  assert.equal(context.port,fakePort); assert.equal(context.writer,fakeWriter);
  assert.equal(context.controllerActive,true); assert.equal(context.boardMode,'RUN');
  assert.equal(JSON.stringify(Blockly.serialization.workspaces.save(workspace)),savedState);
  assert.equal(workspace.getUndoStack().at(-1),fakeEvent);
  assert.equal(workspace.getRedoStack().at(-1),fakeRedo);
  context.isBusy=true;
  vm.runInContext('changeLanguage("en")',context);
  assert.equal(I18n.language,'ja');
} finally {Blockly.svgResize=oldResize; console.warn=oldWarn;}
workspace.dispose();
if(process.argv.includes('--json')) process.stdout.write(JSON.stringify(sources));
else console.log(`PASS: ${Object.keys(en).length} translations, coverage, HELP credit, persistence, 8 bilingual catalogs, both guides, mobile JOG, live switch preserves USB/controller/blocks/undo; busy guard`);
