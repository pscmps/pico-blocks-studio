/* PlotterFlow Motor Shield v0.7; pin facts from board-mappings.json
 * pscmps/plotterflow-motor-shield @ 25aed4887b741969eb9d3d8ba8d62d9c550b7a4b.
 * Original schematic/PCB assets are not bundled. Drawing is a functional sketch. */
globalThis.PlotterShield = (() => {
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === 'string' ? args[0] : String.raw({raw:args[0]},...args.slice(1));
  const source = 'https://github.com/pscmps/plotterflow-motor-shield';
  const mappings = {
    pico: {label:'Pico / W / 2 / 2 W',socket:'J1',pwm:12,serial:13,buttons:[9,10,11],physical:[4,5,6,7,10,9,11,16,12,14,15,1,2,17]},
    lcd147a: {label:'RP2350-LCD-1.47-A',socket:'J2',pwm:9,serial:28,buttons:[25,26,27],physical:[15,16,17,18,2,1,3,4,5,6,7,13,14,9]},
    touch2: {label:'RP2350-Touch-LCD-2 / -C',socket:'J3',pwm:9,serial:21,buttons:[10,11,22],physical:[7,9,11,19,28,20,26,27,12,21,25,10,8,24]},
  };
  const boardKeys = ['shield_pico','shield_picow','shield_pico2','shield_pico2w','shield_lcd147a','shield_touch2'];
  const carrier = board => boardKeys.includes(board) ? board.startsWith('shield_pico') ? 'pico' : board.slice(7) : null;
  const signals = key => {
    const m=mappings[key];
    return ['X_STEP','Y_STEP','X_DIR','Y_DIR','ENABLE','X_LIMIT','Y_LIMIT','Z_SERVO_PWM','BUTTON_UP','BUTTON_DOWN','BUTTON_OK','TMC_UART_TX','TMC_UART_RX','SERIAL_DATA_GPIO'].map((name,i)=>({name,gpio:[2,3,4,5,7,6,8,m.pwm,...m.buttons,0,1,m.serial][i],pin:m.physical[i]}));
  };
  function profiles(base) {
    const result={};
    for(const key of boardKeys) {
      const model=carrier(key),pico=model==='pico',baseBoard=pico?key.slice(7):null;
      const original=pico?base[baseBoard]:base.rp2350_geek;
      const pins=pico?base.pico.pins:model==='lcd147a'?[0,1,2,3,4,5,6,7,8,9,25,26,27,28,29]:[0,1,2,3,4,5,6,7,8,9,10,11,21,22,23];
      result[key]={...original,name:'Motor Shield · '+(pico?original.name.replace('Raspberry Pi ',''):mappings[model].label),
        shield:model,baseBoard,pins,adcPins:pins.filter(p=>p>=26&&p<=29),ledPin:pico?original.ledPin:null,
        layout:pico?'pico':'shield',wifi:!!(pico&&original.wifi),pinoutUrl:source+'/blob/main/docs/gpio-mapping.md'};
    }
    return result;
  }
  function hardware(block) {
    const m=mappings[block.getFieldValue('CARRIER')];
    if(!m)return [];
    const make=(type,fields)=>({type,getFieldValue:k=>fields[k]===undefined?null:String(fields[k])});
    return [make('gcode_stepper',{X_STEP:2,Y_STEP:3,X_DIR:4,Y_DIR:5,ENABLE:7,ACTIVE_LOW:1}),
      make('gcode_pen',{PIN:m.pwm,FREQ:block.getFieldValue('FREQ'),UP:block.getFieldValue('UP'),DOWN:block.getFieldValue('DOWN')})];
  }
  function render(profile,blocks) {
    const m=mappings[profile.shield],hw=blocks.flatMap(b=>b.type==='gcode_shield'?hardware(b):[b]);
    const step=hw.some(b=>b.type==='gcode_stepper'),pen=hw.some(b=>b.type==='gcode_pen');
    const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const txt=(x,y,s,size=10)=>`<text x="${x}" y="${y}" fill="#475467" font-family="sans-serif" font-size="${size}">${esc(s)}</text>`;
    const box=(x,y,w,h,fill='#fff')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="#b8c2cf"/>`;
    let s=box(12,12,316,386,'#f1f7f6')+txt(24,34,'PlotterFlow Motor Shield v0.7',14)+txt(24,52,t('機能図・実機未検証'),10);
    s+=box(158,68,160,52)+txt(166,84,m.socket+' · '+(profile.shield==='pico'?'Pico':profile.shield==='lcd147a'?'LCD-1.47-A':'Touch-LCD-2 / -C'),11)+txt(166,103,t('1枚だけ装着'),10);
    const connector=(ref,x,y,title,labels,active=false)=>{
      s+=`<g data-shield-connector="${ref}" data-active="${active}">`+box(x,y,126,28+labels.length*15,active?'#fff':'#f6f7f9')+txt(x+8,y+18,ref+' · '+title,11);
      labels.forEach((v,i)=>{s+=`<circle cx="${x+10}" cy="${y+32+i*15}" r="3" fill="white" stroke="${active?'#0f766e':'#98a2b3'}"><title>${esc(ref+' pin '+(i+1)+': '+v)}</title></circle>`+txt(x+19,y+36+i*15,(i+1)+' '+v,10);});
      s+='</g>';
    };
    connector('J10',22,68,'X LIMIT',['SIGNAL · GP6','GND','3.3V']);
    connector('J11',22,178,'Y LIMIT',['SIGNAL · GP8','GND','3.3V']);
    connector('J7',190,132,'12V IN',['+12V','GND'],step);
    connector('J8',190,218,'5V IN',['+5V','GND'],pen);
    connector('J12',22,280,'SERIAL',['GND','VCC (J13)','DATA · GP'+m.serial]);
    connector('J13',190,310,'SERVO V',['VCC','GND']);
    s+=txt(156,385,'R20: GP'+m.serial+' → 220 Ω → DATA',8);
    s+=txt(22,424,t('下面：StepStickを2台装着'),12);
    for(const [i,axis] of ['X','Y'].entries()) {
      const x=22+i*158,c=i?'#0891b2':'#7c3aed';
      s+=`<g data-shield-driver="${axis}">`+box(x,438,136,99)+txt(x+8,457,'U'+(i+1)+' · '+axis+' StepStick',12);
      s+=txt(x+8,477,'STEP GP'+(i?3:2)+' / DIR GP'+(i?5:4),10)+txt(x+8,495,'EN GP7 · Low active',10)+txt(x+8,513,'VM ← J7 / VIO 3.3V',10)+txt(x+8,529,'GND',9)+'</g>';
      s+=`<g data-shield-connector="J${i+5}" data-active="${step}">`+box(x,570,136,66)+txt(x+8,622,'J'+(i+5)+' · '+axis+' MOTOR',11);
      for(let j=0;j<4;j++) {
        const px=x+19+j*29;
        s+=txt(px-8,596,['A1','A2','B1','B2'][j],9)+`<circle cx="${px}" cy="570" r="3" fill="white" stroke="${c}"><title>J${i+5} pin ${j+1}</title></circle>`;
        if(step)s+=`<path data-shield-coil="${axis}-${j}" d="M${px} 537 V570" fill="none" stroke="${c}" stroke-width="1.2"/>`;
      }
      s+='</g>';
    }
    connector('J9',22,684,'PWM PEN',['GND','+5V (J8)','PWM · GP'+m.pwm],pen);
    s+=txt(166,708,'R14 · 220 Ω',11)+txt(166,727,'GP'+m.pwm+' → R14 → J9-3',9);
    s+=txt(22,790,t('全GND共通・USBはコントローラへ'),11)+txt(22,808,t('J7・J8・J13の＋同士は接続しない'),11);
    s+=txt(22,837,t('GPIO / コントローラ端子番号'),12);
    signals(profile.shield).forEach((p,i)=>{s+=`<g data-shield-gpio="${p.name}"><title>${esc(m.socket+' / '+p.name+' / GP'+p.gpio+' / pin '+p.pin)}</title>`+txt(22,859+i*18,p.name,10)+txt(190,859+i*18,'GP'+p.gpio+' / #'+p.pin,10)+'</g>';});
    s+=txt(22,1125,'SW1 / SW2 / SW3: UP / DOWN / OK',10)+txt(22,1144,'TMC UART: GP0 TX / GP1 RX · X=0 / Y=1',10);
    return {width:340,height:1170,content:s};
  }
  return {source,mappings,boardKeys,carrier,signals,profiles,hardware,render};
})();
if(typeof module!=='undefined')module.exports=globalThis.PlotterShield;
