/* PlotterFlow RP STEP/DIR adapter. Source and compatibility notes: GCODE.md. */
globalThis.GcodeBlocks = (() => {
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === 'string' ? args[0] : String.raw({raw:args[0]},...args.slice(1));
  const runtimeSource = typeof module !== 'undefined' ? require('./gcode-runtime.js') : globalThis.PlotterFlowRuntime;
  const initTypes = ['gcode_planner','gcode_stepper','gcode_pen','gcode_controller'];
  const uses = blocks => blocks.some(b=>b.type.startsWith('gcode_'));
  function register(Blockly,pinOptions) {
    const n=(name,value,min=1,max=100000)=>({type:'field_number',name,value,min,max});
    const pin=name=>({type:'field_dropdown',name,options:pinOptions});
    const stmt=(type,message0,args0=[],extra={})=>({type:'gcode_'+type,message0,args0,previousStatement:null,nextStatement:null,colour:195,inputsInline:false,...extra});
    const expr=(type,message0,args0=[],output='String')=>({type:'gcode_'+type,message0,args0,output,colour:195});
    const text={type:'input_value',name:'LINE',check:'String'};
    Blockly.defineBlocksWithJsonArray([
      stmt('planner',t('XY座標：X %1 / Y %2 step/mm'),[n('X',80,0.001),n('Y',80,0.001)]),
      stmt('stepper',t('外付けSTEP/DIRドライバ（TMCなど）'),[],{message1:'X STEP %1 / Y STEP %2',args1:[pin('X_STEP'),pin('Y_STEP')],message2:'X DIR %1 / Y DIR %2',args2:[pin('X_DIR'),pin('Y_DIR')],message3:t('共通EN %1 / 有効レベル %2'),args3:[pin('ENABLE'),{type:'field_dropdown',name:'ACTIVE_LOW',options:[['Low','1'],['High','0']]}],tooltip:t('モータ直結は禁止。各軸に外付けドライバと外部電源が必要です。Y STEPはX STEPの次のGPIO。TMCのUART設定は行いません。')}),
      stmt('pen',t('PWMペン：GPIO %1 / 周波数 %2 Hz'),[pin('PIN'),n('FREQ',50,1,400)],{message1:t('上げる %1 µs / 下げる %2 µs'),args1:[n('UP',1000,100,3000),n('DOWN',1800,100,3000)]}),
      stmt('controller',t('Gcode処理を開始'),[],{tooltip:t('Gcode開始より前にXY・STEP/DIR・PWMペンを設定してください。')}),
      expr('read',t('USBからGcodeを1行受信（改行まで待つ）')),
      expr('reply',t('Gcode %1 を実行した応答'),[text]),
      expr('ready',t('PlotterFlow起動メッセージ：%1'),[{type:'field_input',name:'BOARD',text:'pico2-stepdir'}]),
      expr('parse',t('Gcode %1 を解析（命令・数値の辞書）'),[text],'Dictionary'),
      expr('state',t('Gcodeの状態 %1'),[{type:'field_dropdown',name:'KEY',options:[['X','x'],['Y','y'],['Z','z'],['F (mm/min)','feed'],[t('絶対座標'),'absolute'],[t('単位mm'),'mm'],[t('モータ有効'),'enabled'],[t('ペン指令'),'pen_down']]}],null),
    ]);
    for(const [type,fields,defaults] of [['gcode_stepper',['X_STEP','Y_STEP','X_DIR','Y_DIR','ENABLE'],[2,3,4,5,7]],['gcode_pen',['PIN'],[12]]]) {
      const init=Blockly.Blocks[type].init;
      Blockly.Blocks[type].init=function(){init.call(this);const pins=pinOptions().map(p=>p[1]);fields.forEach((field,i)=>this.setFieldValue(pins.includes(String(defaults[i]))?String(defaults[i]):pins[i%pins.length],field));};
    }
  }
  function toolbox() {
    return {kind:'category',name:'Gcode',colour:'#478c9e',contents:['planner','stepper','pen','controller','read','reply','ready','parse','state'].map(type=>({kind:'block',type:'gcode_'+type,...(['reply','parse'].includes(type)?{inputs:{LINE:{shadow:{type:'basic_text',fields:{TEXT:'M115'}}}}}:{})}))};
  }
  function expression(b,expression) {
    const v=()=>expression(b.getInputTargetBlock('LINE'),"''");
    switch(b.type) {
      case 'gcode_read':return '_pf_readline()';
      case 'gcode_reply':return `_pf_reply(${v()})`;
      case 'gcode_parse':return `_pf_parse_dict(${v()})`;
      case 'gcode_ready':return JSON.stringify('PlotterFlow MicroPython RP ready; board='+b.getFieldValue('BOARD'));
      case 'gcode_state':return `_pf_controller.modal.${['x','y','z','feed','absolute','mm','enabled','pen_down'].includes(b.getFieldValue('KEY'))?b.getFieldValue('KEY'):'x'}`;
      default:return null;
    }
  }
  function statement(b) {
    const n=k=>Number(b.getFieldValue(k));
    switch(b.type) {
      case 'gcode_planner':return `_pf_planner = CartesianPlanner(${n('X')}, ${n('Y')})\n`;
      case 'gcode_stepper':return `_pf_stepper = StepperPIO(${n('X_STEP')}, ${n('Y_STEP')}, ${n('X_DIR')}, ${n('Y_DIR')}, ${n('ENABLE')}, ${n('ACTIVE_LOW')?'True':'False'})\n`;
      case 'gcode_pen':return `_pf_pen = Pen(${n('PIN')}, ${n('FREQ')}, ${n('UP')}, ${n('DOWN')})\n`;
      case 'gcode_controller':return '_pf_controller = Controller(_pf_planner, _pf_stepper, _pf_pen)\n';
      default:return null;
    }
  }
  function runtime(blocks) {return uses(blocks)?runtimeSource:'';}
  function wrap(code,blocks,indent) {
    return blocks.some(b=>['gcode_stepper','gcode_pen'].includes(b.type))?`try:\n${indent(code)}finally:\n    if _pf_stepper is not None:\n        _pf_stepper.close()\n    if _pf_pen is not None:\n        _pf_pen.close()\n`:code;
  }
  function validate(blocks,profile) {
    if(!uses(blocks))return '';
    if(profile.platform==='esp32')return t('Gcode STEP/DIRはRP2040 / RP2350用です。ATOM Liteには対応していません。');
    if(blocks.some(b=>/^(uart_controller_setup|wifi_jog_setup|adv_irq|adv_timer|scs009_setup|xl330_setup|sts3215_setup|sts3235_setup|pwm_setup)$/.test(b.type)))return t('Gcodeは専用プログラムです。JOG・通常のサーボ接続・割り込み・タイマーとは分け、ペンにはGcodeのPWMペンを使ってください。');
    const top=[];for(let b=blocks.find(b=>b.type==='program_start');b;b=b.getNextBlock())top.push(b);
    const required=blocks.some(b=>['gcode_controller','gcode_reply','gcode_state'].includes(b.type));
    for(const type of initTypes) {
      const list=blocks.filter(b=>b.type===type);
      if(list.length>1||list.some(b=>!top.includes(b))||(required&&list.length!==1))return t('XY・STEP/DIR・PWMペン・Gcode開始を各1個、プログラム開始の直下へ置いてください。');
    }
    if(required) {
      const start=top.findIndex(b=>b.type==='gcode_controller');
      if(initTypes.slice(0,3).some(type=>top.findIndex(b=>b.type===type)>start))return t('Gcode開始より前にXY・STEP/DIR・PWMペンを設定してください。');
      for(const b of blocks.filter(b=>['gcode_reply','gcode_state'].includes(b.type))) {
        let p=b;while(p&&!top.includes(p))p=p.getParent();
        if(!p||top.indexOf(p)<=start||['adv_function','adv_python_function','adv_irq','adv_timer'].includes(p.type))return t('Gcodeの実行・状態取得はGcode開始より後につないでください。');
      }
    }
    const step=blocks.find(b=>b.type==='gcode_stepper'),pen=blocks.find(b=>b.type==='gcode_pen');
    const pins=step?['X_STEP','Y_STEP','X_DIR','Y_DIR','ENABLE'].map(k=>Number(step.getFieldValue(k))):[];
    if(step&&Number(step.getFieldValue('Y_STEP'))!==Number(step.getFieldValue('X_STEP'))+1)return t('Y STEPにはX STEPの次のGPIO番号を選んでください。');
    if(pen)pins.push(Number(pen.getFieldValue('PIN')));
    if(new Set(pins).size!==pins.length||pins.some(p=>!profile.pins.includes(p)))return t('GcodeのGPIOは、このボードで使用可能な別々の端子を選んでください。');
    for(const b of blocks.filter(b=>!b.type.startsWith('gcode_'))) {
      if(['PIN','SCL','SDA','SCK','MOSI','MISO','CS'].some(k=>b.getFieldValue(k)!==null&&b.getFieldValue(k)!==undefined&&pins.includes(Number(b.getFieldValue(k)))))return t('GcodeのGPIOと他の入出力が重複しています。');
      if(pen&&['pwm_setup','adv_pwm'].includes(b.type)&&((Number(b.getFieldValue('PIN'))>>1)%8)===(Number(pen.getFieldValue('PIN'))>>1)%8)return t('PWMペンと他のPWMが同じPWMスライスを使っています。');
    }
    if(pen&&Math.max(Number(pen.getFieldValue('UP')),Number(pen.getFieldValue('DOWN')))*Number(pen.getFieldValue('FREQ'))>=1000000)return t('PWMペンのパルス幅は1周期より短くしてください。');
    return '';
  }
  return {register,toolbox,expression,statement,runtime,wrap,validate,uses};
})();
if(typeof module!=='undefined')module.exports=globalThis.GcodeBlocks;
