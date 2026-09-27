/* Portable MicroPython blocks, including explicit device-side Python bodies. */
globalThis.AdvancedBlocks = (() => {
  const gcode = typeof module !== 'undefined' ? require('./gcode.js') : globalThis.GcodeBlocks;
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === "string" ? args[0] : String.raw({raw:args[0]}, ...args.slice(1));
  const val = (name, check=null) => ({type:"input_value",name,...(check?{check}:{})});
  const num = (name,value,min=0,max=65535) => ({type:"field_number",name,value,min,max,precision:1});
  const name = (field="NAME") => ({type:"field_input",name:field,text:field === "ARG" ? "x" : "data"});
  const choice = (name,options) => ({type:"field_dropdown",name,options});
  const body = field => ({type:"input_statement",name:field});
  const stmt = (type,message0,args0=[],extra={}) => ({type:"adv_"+type,message0,args0,previousStatement:null,nextStatement:null,colour:174,inputsInline:true,...extra});
  const expr = (type,message0,args0=[],output=null,extra={}) => ({type:"adv_"+type,message0,args0,output,colour:244,inputsInline:true,...extra});
  const ident = value => "adv_fn_" + Array.from(String(value)).map(c=>c.codePointAt(0).toString(16)).join("_");
  const eventTypes = new Set(["adv_irq","adv_timer"]);
  const hasEvents = blocks => blocks.some(b=>eventTypes.has(b.type));
  let pythonFieldRegistered = false;
  const pythonBody = value => String(value ?? "").replace(/\r\n?/g,"\n");
  function register(Blockly,pinOptions) {
    gcode.register(Blockly,pinOptions);
    if (!pythonFieldRegistered) {
      const Multiline = typeof module !== "undefined" ? require("@blockly/field-multilineinput").FieldMultilineInput : globalThis.FieldMultilineInput;
      class PythonBodyField extends Multiline {
        widgetCreate_() {
          const input = super.widgetCreate_();
          input.setAttribute("aria-label", t("Python関数の本文"));
          input.setAttribute("autocapitalize", "off");
          input.setAttribute("autocomplete", "off");
          input.spellcheck = false;
          return input;
        }
        onHtmlInputKeyDown_(event) {
          if (event.key === "Tab" && !event.shiftKey) {
            event.preventDefault(); event.stopPropagation();
            this.htmlInput_.setRangeText("    ",this.htmlInput_.selectionStart,this.htmlInput_.selectionEnd,"end");
            this.htmlInput_.dispatchEvent(new Event("input",{bubbles:true}));
          } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault(); event.stopPropagation(); Blockly.WidgetDiv.hide();
          } else super.onHtmlInputKeyDown_(event);
        }
      }
      Blockly.fieldRegistry.register("field_python_body", PythonBodyField);
      pythonFieldRegistered = true;
    }
    const pin = field => ({type:"field_dropdown",name:field,options:pinOptions});
    const bus = () => num("BUS",1,1,2);
    const defs = [
      expr("list_empty",t("空の配列"),[],"Array"),
      expr("list_new",t("配列 [%1, %2, %3]"),[val("A"),val("B"),val("C")],"Array"),
      expr("list_get",t("配列 %1 の %2 番目"),[val("LIST",["Array","Bytes"]),val("INDEX","Number")]),
      stmt("list_set",t("配列 %1 の %2 番目を %3 にする"),[val("LIST","Array"),val("INDEX","Number"),val("VALUE")]),
      stmt("list_append",t("配列 %1 の末尾に %2 を追加"),[val("LIST","Array"),val("VALUE")]),
      expr("list_pop",t("配列 %1 の末尾を取り出す"),[val("LIST","Array")]),
      expr("length",t("%1 の長さ"),[val("VALUE")],"Number"),
      expr("contains",t("%1 に %2 が含まれる"),[val("VALUE"),val("ITEM")],"Boolean"),
      expr("slice",t("%1 の %2 番目から %3 番目の手前まで"),[val("VALUE"),val("START","Number"),val("END","Number")]),
      stmt("for_each",t("配列 %1 の各要素を変数 %2 に入れて"),[val("LIST","Array"),name()],{message1:"%1",args1:[body("DO")],inputsInline:false}),
      expr("array",t("数値配列 %1 を %2 型にする"),[val("LIST","Array"),choice("TYPE",[["uint8","B"],["int16","h"],["int32","i"],["float","f"]])],"Array"),
      expr("bytes",t("配列 %1 をバイト列にする"),[val("LIST","Array")],"Bytes"),
      expr("dict_empty",t("空の辞書"),[],"Dictionary"),
      stmt("dict_set",t("辞書 %1 のキー %2 を %3 にする"),[val("DICT","Dictionary"),val("KEY"),val("VALUE")]),
      expr("dict_get",t("辞書 %1 のキー %2（なければ %3）"),[val("DICT","Dictionary"),val("KEY"),val("DEFAULT")]),
      expr("dict_keys",t("辞書 %1 のキー一覧"),[val("DICT","Dictionary")],"Array"),
      stmt("function",t("関数 %1 を定義（引数は「引数の値」）"),[name()],{message1:"%1",args1:[body("DO")],message2:t("戻り値 %1"),args2:[val("RETURN")],inputsInline:false}),
      stmt("python_function",t("Pythonで関数 %1 を作る"),[{type:"field_input",name:"NAME",text:"custom"}],{message1:t("引数 arg ／ 戻り値 return"),message2:"%1",args2:[{type:"field_python_body",name:"CODE",text:"result = arg * 2\nreturn result",maxLines:10,spellcheck:false}],inputsInline:false,tooltip:t("関数の本文だけを書きます。def行は不要。プログラム開始の直下に置き、同じ名前の関数呼び出しブロックから使います。Enterで改行、Tabで4スペース、Ctrl+Enterで確定。コードはボード上で実行され、配線・文法は自動検査しません。")}),
      expr("arg",t("引数の値")),
      expr("call",t("関数 %1（引数 %2）の結果"),[name(),val("ARG")]),
      stmt("call_do",t("関数 %1 を実行（引数 %2）"),[name(),val("ARG")]),
      stmt("flow",t("くり返しを %1"),[choice("ACTION",[[t("抜ける"),"BREAK"],[t("次へ進める"),"CONTINUE"]])]),
      stmt("try",t("処理を試す %1"),[body("DO")],{message1:t("エラーなら %1"),args1:[body("EXCEPT")],message2:t("最後に必ず %1"),args2:[body("FINALLY")],inputsInline:false}),
      expr("convert",t("%1 を %2 に変換"),[val("VALUE"),choice("TYPE",[[t("整数"),"int"],[t("小数"),"float"],[t("文字列"),"str"],[t("真偽値"),"bool"]])]),
      expr("split",t("文字列 %1 を %2 で分割"),[val("TEXT","String"),val("SEP","String")],"Array"),
      expr("replace",t("文字列 %1 の %2 を %3 に置換"),[val("TEXT","String"),val("OLD","String"),val("NEW","String")],"String"),
      expr("json_encode",t("%1 をJSON文字列にする"),[val("VALUE")],"String"),
      expr("json_decode",t("JSON文字列 %1 を読み取る"),[val("TEXT","String")]),
      expr("bitwise",t("整数 %1 %2 %3"),[val("A","Number"),choice("OP",[["AND","AND"],["OR","OR"],["XOR","XOR"],["<<","SHL"],[">>","SHR"]]),val("B","Number")],"Number"),
      expr("math",t("%1（%2）"),[choice("OP",[["sin","sin"],["cos","cos"],["tan","tan"],["log","log"],["exp","exp"],[t("度→ラジアン"),"radians"],[t("ラジアン→度"),"degrees"]]),val("VALUE","Number")],"Number"),
      expr("ticks_us",t("起動からのマイクロ秒"),[],"Number"),
      expr("elapsed_us",t("%1 から %2 までの時間差（µs）"),[val("START","Number"),val("END","Number")],"Number"),
      expr("mem_free",t("空きメモリ（バイト）"),[],"Number"),
      stmt("gc",t("不要なメモリを回収")),
      stmt("irq",t("GPIO %1 の %2 で割り込み"),[pin("PIN"),choice("EDGE",[[t("立ち下がり"),"FALLING"],[t("立ち上がり"),"RISING"],[t("両方"),"BOTH"]])],{message1:t("入力 %1  連続反応を抑える %2 ms"),args1:[choice("PULL",[[t("プルアップ"),"UP"],[t("プルダウン"),"DOWN"],[t("なし"),"NONE"]]),num("DEBOUNCE",30,0,5000)],message2:"%1",args2:[body("DO")],inputsInline:false,tooltip:t("変化を記録し、中の処理は通常の実行側で動かします。短時間の複数イベントは1回にまとめます。高速パルス計数には使えません。")}),
      stmt("irq_stop",t("GPIO %1 の割り込みを停止"),[pin("PIN")]),
      stmt("timer",t("ソフトタイマー %1：%2 ms後に %3"),[num("TIMER",1,1,8),num("PERIOD",1000,1,86400000),choice("MODE",[[t("くり返す"),"REPEAT"],[t("1回だけ"),"ONCE"]])],{message1:"%1",args1:[body("DO")],inputsInline:false,tooltip:t("通常の実行側で時間を確認します。処理中は遅延し、過ぎた回数をまとめて実行しません。精密な周期出力には使えません。")}),
      stmt("timer_stop",t("ソフトタイマー %1 を停止"),[num("TIMER",1,1,8)]),
      stmt("pwm",t("GPIO %1 のPWM：%2 Hz  デューティ %3 / 65535"),[pin("PIN"),num("FREQ",1000,1,100000),val("DUTY","Number")],{tooltip:t("サーボ用とは別の汎用PWMです。RPでは同じPWMスライスをサーボと共用できません。")}),
      stmt("pwm_stop",t("GPIO %1 のPWMを停止"),[pin("PIN")]),
      stmt("i2c_setup",t("ソフトI2C %1：SCL %2  SDA %3"),[bus(),pin("SCL"),pin("SDA")],{message1:t("通信速度 %1 Hz"),args1:[num("FREQ",100000,1000,400000)],inputsInline:false,tooltip:t("3.3 V信号専用。SCL・SDAには3.3 Vへのプルアップが必要です。周辺機器の仕様を確認してください。")}),
      expr("i2c_scan",t("I2C %1 のアドレス一覧"),[bus()],"Array"),
      expr("i2c_read",t("I2C %1：アドレス %2  レジスタ %3  読む長さ %4"),[bus(),num("ADDRESS",64,8,119),num("REGISTER",0,0,255),num("SIZE",1,1,256)],"Bytes"),
      stmt("i2c_write",t("I2C %1：アドレス %2  レジスタ %3  書くバイト列 %4"),[bus(),num("ADDRESS",64,8,119),num("REGISTER",0,0,255),val("DATA",["Array","Bytes"])]),
      stmt("spi_setup",t("ソフトSPI %1：SCK %2  MOSI %3"),[bus(),pin("SCK"),pin("MOSI")],{message1:t("MISO %1  CS %2  通信速度 %3 Hz"),args1:[pin("MISO"),pin("CS"),num("FREQ",100000,1000,1000000)],message2:"CPOL %1  CPHA %2",args2:[num("POLARITY",0,0,1),num("PHASE",0,0,1)],inputsInline:false,tooltip:t("8ビット・MSB先頭・CSはLow有効。通信中だけCSを下げます。すべて別々のGPIOを選んでください。")}),
      expr("spi_transfer",t("SPI %1 へ %2 を送り返答を読む"),[bus(),val("DATA",["Array","Bytes"])],"Bytes"),
    ];
    Blockly.defineBlocksWithJsonArray(defs);
    // Give multi-pin connections valid distinct defaults on every board.
    for (const [type, fields] of [["adv_i2c_setup",["SCL","SDA"]],["adv_spi_setup",["SCK","MOSI","MISO","CS"]]]) {
      const init = Blockly.Blocks[type].init;
      Blockly.Blocks[type].init = function() {
        init.call(this);
        fields.forEach((field,i)=>this.setFieldValue(pinOptions()[i % pinOptions().length][1],field));
      };
    }
  }
  const shadow = n => ({shadow:{type:"basic_number",fields:{NUM:n}}});
  const txt = text => ({shadow:{type:"basic_text",fields:{TEXT:text}}});
  const item = (type,inputs={}) => ({kind:"block",type:"adv_"+type,inputs});
  function toolbox() {
    const category = (name,colour,contents)=>({kind:"category",name,colour,contents});
    return {kind:"category",name:t("高度なブロック"),colour:"#63728e",contents:[
      category(t("ブロック作成（Python）"),"#7184a2",[item("python_function"),{...item("call",{ARG:shadow(0)}),fields:{NAME:"custom"}},{...item("call_do",{ARG:shadow(0)}),fields:{NAME:"custom"}}]),
      category(t("配列・辞書"),"#8174aa",[
        item("list_empty"),item("list_new",{A:shadow(1),B:shadow(2),C:shadow(3)}),item("list_get",{INDEX:shadow(0)}),item("list_set",{INDEX:shadow(0),VALUE:shadow(0)}),item("list_append",{VALUE:shadow(0)}),item("list_pop"),item("length"),item("contains"),item("slice",{START:shadow(0),END:shadow(3)}),item("for_each"),item("array"),item("bytes"),item("dict_empty"),item("dict_set",{KEY:txt("key"),VALUE:shadow(0)}),item("dict_get",{KEY:txt("key"),DEFAULT:shadow(0)}),item("dict_keys")]),
      category(t("関数・処理の制御"),"#7d86ac",[item("function",{RETURN:shadow(0)}),item("arg"),item("call",{ARG:shadow(0)}),item("call_do",{ARG:shadow(0)}),item("flow"),item("try")]),
      category(t("割り込み・タイマー"),"#529c93",[item("irq"),item("irq_stop"),item("timer"),item("timer_stop")]),
      category(t("文字列・型変換"),"#a777a1",[item("convert",{VALUE:txt("123")}),item("split",{TEXT:txt("a,b,c"),SEP:txt(",")}),item("replace",{TEXT:txt("Hello"),OLD:txt("Hello"),NEW:txt("Hi")}),item("json_encode"),item("json_decode",{TEXT:txt("{}")})]),
      category(t("ビット演算・数学"),"#6486a8",[item("bitwise",{A:shadow(3),B:shadow(1)}),item("math",{VALUE:shadow(0)})]),
      category(t("汎用PWM"),"#b59458",[item("pwm",{DUTY:shadow(32768)}),item("pwm_stop")]),
      category("I2C / SPI","#61979b",[item("i2c_setup"),item("i2c_scan"),item("i2c_read"),item("i2c_write"),item("spi_setup"),item("spi_transfer")]),
      category(t("時間・メモリ"),"#6b8b9a",[item("ticks_us"),item("elapsed_us"),item("mem_free"),item("gc")]),
      gcode.toolbox(),
    ]};
  }
  function expression(block,expression) {
    const f=n=>block.getFieldValue(n), v=(n,d="0")=>expression(block.getInputTargetBlock(n),d);
    switch(block.type) {
      case "adv_list_empty":return "[]";
      case "adv_list_new":return `[${v("A")}, ${v("B")}, ${v("C")}]`;
      case "adv_list_get":return `(${v("LIST","[]")})[int(${v("INDEX")})]`;
      case "adv_list_pop":return `(${v("LIST","[]")}).pop()`;
      case "adv_length":return `len(${v("VALUE","[]")})`;
      case "adv_contains":return `(${v("ITEM")} in ${v("VALUE","[]")})`;
      case "adv_slice":return `(${v("VALUE","[]")})[int(${v("START")}):int(${v("END","3")})]`;
      case "adv_array":return `array.array(${JSON.stringify(f("TYPE"))}, ${v("LIST","[]")})`;
      case "adv_bytes":return `bytes(${v("LIST","[]")})`;
      case "adv_dict_empty":return "{}";
      case "adv_dict_get":return `(${v("DICT","{}")}).get(${v("KEY","''")}, ${v("DEFAULT")})`;
      case "adv_dict_keys":return `list((${v("DICT","{}")}).keys())`;
      case "adv_arg":return "_adv_arg";
      case "adv_call":return `${ident(f("NAME"))}(${v("ARG")})`;
      case "adv_convert":return `${({int:"int",float:"float",str:"str",bool:"bool"})[f("TYPE")] || "str"}(${v("VALUE")})`;
      case "adv_split":return `str(${v("TEXT","''")}).split(str(${v("SEP","','")}))`;
      case "adv_replace":return `str(${v("TEXT","''")}).replace(str(${v("OLD","''")}), str(${v("NEW","''")}))`;
      case "adv_json_encode":return `json.dumps(${v("VALUE","{}")})`;
      case "adv_json_decode":return `json.loads(${v("TEXT","'{}'")})`;
      case "adv_bitwise":return `(int(${v("A")}) ${({AND:"&",OR:"|",XOR:"^",SHL:"<<",SHR:">>"})[f("OP")] || "&"} int(${v("B")}))`;
      case "adv_math":return `math.${["sin","cos","tan","log","exp","radians","degrees"].includes(f("OP"))?f("OP"):"sin"}(${v("VALUE")})`;
      case "adv_ticks_us":return "time.ticks_us()";
      case "adv_elapsed_us":return `time.ticks_diff(${v("END","time.ticks_us()")}, ${v("START")})`;
      case "adv_mem_free":return "gc.mem_free()";
      case "adv_i2c_scan":return `_adv_i2c[${Number(f("BUS"))}].scan()`;
      case "adv_i2c_read":return `_adv_i2c[${Number(f("BUS"))}].readfrom_mem(${Number(f("ADDRESS"))}, ${Number(f("REGISTER"))}, ${Number(f("SIZE"))})`;
      case "adv_spi_transfer":return `_adv_spi_transfer(${Number(f("BUS"))}, ${v("DATA","[]")})`;
      default:return gcode.expression(block,expression);
    }
  }
  function statement(block,expression,chain,indent,variableName,jog,events) {
    const f=n=>block.getFieldValue(n), n=k=>Number(f(k)), v=(k,d="0")=>expression(block.getInputTargetBlock(k),d);
    const body=k=>indent(chain(block.getInputTargetBlock(k))) || "    pass\n";
    switch(block.type) {
      case "adv_list_set":return `(${v("LIST","[]")})[int(${v("INDEX")})] = ${v("VALUE")}\n`;
      case "adv_list_append":return `(${v("LIST","[]")}).append(${v("VALUE")})\n`;
      case "adv_dict_set":return `(${v("DICT","{}")})[${v("KEY","''")}] = ${v("VALUE")}\n`;
      case "adv_for_each":return `for ${variableName(f("NAME"))} in ${v("LIST","[]")}:\n${events?"    _adv_poll()\n":jog?"    _controller_poll()\n":""}${body("DO")}`;
      case "adv_function":return "pass\n";
      case "adv_python_function":return "pass\n";
      case "adv_call_do":return `${ident(f("NAME"))}(${v("ARG")})\n`;
      case "adv_flow":return f("ACTION")==="BREAK" ? "break\n":"continue\n";
      case "adv_try":return `try:\n${body("DO")}except Exception:\n${body("EXCEPT")}finally:\n${body("FINALLY")}`;
      case "adv_gc":return "gc.collect()\n";
      case "adv_irq": {
        const edge = {FALLING:"Pin.IRQ_FALLING",RISING:"Pin.IRQ_RISING",BOTH:"Pin.IRQ_FALLING | Pin.IRQ_RISING"}[f("EDGE")];
        const pull = {UP:", Pin.PULL_UP",DOWN:", Pin.PULL_DOWN",NONE:""}[f("PULL")];
        return `_adv_irq_pins[${n("PIN")}] = Pin(${n("PIN")}, Pin.IN${pull})\n_adv_events[${n("PIN")}] = [False, time.ticks_add(time.ticks_ms(), -${n("DEBOUNCE")}), ${n("DEBOUNCE")}, _adv_irq_body_${n("PIN")}]\n_adv_irq_pins[${n("PIN")}].irq(handler=_adv_irq_signal_${n("PIN")}, trigger=${edge}, hard=False)\n`;
      }
      case "adv_irq_stop":return `_adv_stop_irq(${n("PIN")})\n`;
      case "adv_timer":return `_adv_timers[${n("TIMER")}] = [time.ticks_add(time.ticks_ms(), ${n("PERIOD")}), ${n("PERIOD")}, _adv_timer_body_${n("TIMER")}, ${f("MODE")==="REPEAT"?"True":"False"}]\n`;
      case "adv_timer_stop":return `_adv_timers.pop(${n("TIMER")}, None)\n`;
      case "adv_pwm":return `_adv_set_pwm(${n("PIN")}, ${n("FREQ")}, ${v("DUTY")})\n`;
      case "adv_pwm_stop":return `_adv_stop_pwm(${n("PIN")})\n`;
      case "adv_i2c_setup":return `_adv_i2c[${n("BUS")}] = SoftI2C(scl=Pin(${n("SCL")}), sda=Pin(${n("SDA")}), freq=${n("FREQ")})\n`;
      case "adv_i2c_write":return `_adv_i2c[${n("BUS")}].writeto_mem(${n("ADDRESS")}, ${n("REGISTER")}, bytes(${v("DATA","[]")}))\n`;
      case "adv_spi_setup":return `_adv_cs[${n("BUS")}] = Pin(${n("CS")}, Pin.OUT, value=1)\n_adv_spi[${n("BUS")}] = SoftSPI(baudrate=${n("FREQ")}, polarity=${n("POLARITY")}, phase=${n("PHASE")}, bits=8, firstbit=SoftSPI.MSB, sck=Pin(${n("SCK")}), mosi=Pin(${n("MOSI")}), miso=Pin(${n("MISO")}))\n`;
      default:return gcode.statement(block);
    }
  }
  function runtime(blocks,profile,jog) {
    const types=new Set(blocks.map(b=>b.type));
    let code=gcode.runtime(blocks);
    if(types.has("adv_array"))code+="import array\n";
    if(types.has("adv_math"))code+="import math\n";
    if(types.has("adv_json_encode")||types.has("adv_json_decode"))code+="import json\n";
    if(types.has("adv_gc")||types.has("adv_mem_free"))code+="import gc\n";
    if([...types].some(s=>s.startsWith("adv_i2c_")))code+="from machine import SoftI2C\n_adv_i2c = {}\n";
    if([...types].some(s=>s.startsWith("adv_spi_")))code+=SPI_RUNTIME;
    if(types.has("adv_pwm")||types.has("adv_pwm_stop"))code+=PWM_RUNTIME;
    if(hasEvents(blocks))code+=EVENT_RUNTIME.replace("# JOG_POLL",jog?"_controller_poll()":"pass");
    return code;
  }
  function definitions(blocks,chain,indent,expression,variableName) {
    const names=[...new Set(blocks.filter(b=>["basic_get","basic_set","basic_change","adv_for_each"].includes(b.type)).map(b=>variableName(b.getFieldValue("NAME"))))];
    const globals=names.length?`    global ${names.join(", ")}\n`:"";
    let code="";
    for(const b of blocks) {
      if (b.type === "adv_python_function") {
        // Indent only; never evaluate pasted code in the browser. Appending
        // pass also makes an empty or comment-only body a valid definition.
        code += `\ndef ${ident(b.getFieldValue("NAME"))}(arg):\n${indent(pythonBody(b.getFieldValue("CODE")))}\n    pass\n`;
        continue;
      }
      if(!eventTypes.has(b.type)&&b.type!=="adv_function")continue;
      const f=n=>b.getFieldValue(n), fn=b.type==="adv_function"?ident(f("NAME")):b.type==="adv_irq"?"_adv_irq_body_"+Number(f("PIN")):"_adv_timer_body_"+Number(f("TIMER"));
      code+=`\ndef ${fn}(${b.type==="adv_function"?"_adv_arg":""}):\n${globals}${indent(chain(b.getInputTargetBlock("DO")))||"    pass\n"}`;
      if(b.type==="adv_function")code+=`    return ${expression(b.getInputTargetBlock("RETURN"))}\n`;
      if(b.type==="adv_irq")code+=`\ndef _adv_irq_signal_${Number(f("PIN"))}(_pin):\n    _adv_events[${Number(f("PIN"))}][0] = True\n`;
    }
    return code;
  }
  function wrap(code,blocks,indent) {
    code=gcode.wrap(code,blocks,indent);
    if(!hasEvents(blocks))return code;
    return `try:\n${indent(code)}    while True:\n        _adv_poll()\n        time.sleep_ms(1)\nfinally:\n    for _pin in list(_adv_irq_pins):\n        _adv_stop_irq(_pin)\n    _adv_timers.clear()\n`;
  }
  function validate(blocks,profile) {
    const gcodeError=gcode.validate(blocks,profile);
    if(gcodeError)return gcodeError;
    const setups=blocks.filter(b=>["adv_function","adv_python_function","adv_irq","adv_timer","adv_i2c_setup","adv_spi_setup"].includes(b.type));
    const starts=blocks.filter(b=>b.type==="program_start"), top=new Set();
    for(const start of starts)for(let b=start;b;b=b.getNextBlock())top.add(b);
    if(setups.some(b=>!top.has(b)))return t("関数・割り込み・タイマー・I2C/SPIの開始は、プログラム開始の直下につないでください。");
    for(const [type,field]of [["adv_function","NAME"],["adv_irq","PIN"],["adv_timer","TIMER"],["adv_i2c_setup","BUS"],["adv_spi_setup","BUS"]]) {
      const values=setups.filter(b=>b.type===type).map(b=>String(b.getFieldValue(field)));
      if(new Set(values).size!==values.length)return t("高度なブロックの名前・番号・割り込みGPIOが重複しています。");
    }
    const functionNames=setups.filter(b=>["adv_function","adv_python_function"].includes(b.type)).map(b=>b.getFieldValue("NAME"));
    if(new Set(functionNames).size!==functionNames.length)return t("関数名が重複しています。Python関数と通常の関数には別の名前を付けてください。");
    for(const b of setups.filter(b=>b.type==="adv_python_function")) {
      if(!String(b.getFieldValue("NAME")).trim())return t("Python関数に名前を付けてください。");
      const code=pythonBody(b.getFieldValue("CODE"));
      if(code.length>16384 || code.includes("\0"))return t("Python本文は16384文字以内にし、NUL文字を含めないでください。");
    }
    const functions=new Set(functionNames);
    if(blocks.some(b=>["adv_call","adv_call_do"].includes(b.type)&&!functions.has(b.getFieldValue("NAME"))))return t("呼び出す名前の関数定義を追加してください。");
    for(const b of blocks) {
      if(b.type==="adv_arg"||b.type==="adv_flow") {
        let p=b.getSurroundParent?.(), valid=false;
        while(p) {
          if(b.type==="adv_arg"&&p.type==="adv_function"){valid=true;break;}
          if(b.type==="adv_flow"&&["basic_repeat","basic_while","forever_loop","repeat_times","adv_for_each"].includes(p.type)){valid=true;break;}
          if(["adv_function","adv_irq","adv_timer"].includes(p.type))break;
          p=p.getSurroundParent?.();
        }
        if(!valid)return t("引数の値は関数の中、くり返しの制御はループの中だけで使えます。");
      }
      for(const bus of ["i2c","spi"])if(b.type.startsWith("adv_"+bus+"_")&&b.type!=="adv_"+bus+"_setup"&&!setups.some(s=>s.type==="adv_"+bus+"_setup"&&s.getFieldValue("BUS")===b.getFieldValue("BUS")))return t("同じ番号のI2C/SPI接続ブロックを追加してください。");
      if(b.type==="adv_irq_stop"&&!setups.some(s=>s.type==="adv_irq"&&s.getFieldValue("PIN")===b.getFieldValue("PIN")))return t("停止するGPIOの割り込み開始ブロックを追加してください。");
      if(b.type==="adv_timer_stop"&&!setups.some(s=>s.type==="adv_timer"&&s.getFieldValue("TIMER")===b.getFieldValue("TIMER")))return t("停止する番号のソフトタイマーを追加してください。");
    }
    const claims=[];
    for(const b of blocks) {
      const fields=b.type==="adv_i2c_setup"?["SCL","SDA"]:b.type==="adv_spi_setup"?["SCK","MOSI","MISO","CS"]:["adv_irq","adv_pwm","adv_pwm_stop"].includes(b.type)?["PIN"]:[];
      for(const field of fields)claims.push({pin:Number(b.getFieldValue(field)),kind:b.type.startsWith("adv_pwm")?"pwm":b.type,block:b});
    }
    for(const c of claims) {
      if(!profile.pins.includes(c.pin))return t("高度なブロックに、このボードでは使えないGPIOがあります。");
      if(claims.some(d=>d!==c&&d.pin===c.pin&&!(c.kind==="pwm"&&d.kind==="pwm")))return t("割り込み・I2C・SPI・PWMには、それぞれ別のGPIOを指定してください。");
      if(blocks.some(b=>/^(basic_(adc|read|write)|gpio_write|(scs009|xl330|sts3215|sts3235|pwm)_setup)$/.test(b.type)&&Number(b.getFieldValue("PIN"))===c.pin))return t("高度なブロックとサーボ・基本入出力のGPIOが重複しています。");
    }
    if(profile.platform!=="esp32") {
      const pwms=blocks.filter(b=>b.type==="adv_pwm"||b.type==="pwm_setup");
      for(const a of pwms.filter(b=>b.type==="adv_pwm"))if(pwms.some(b=>b!==a&&Number(b.getFieldValue("PIN"))!==Number(a.getFieldValue("PIN"))&&(Number(b.getFieldValue("PIN"))>>1)%8===(Number(a.getFieldValue("PIN"))>>1)%8))return t("汎用PWMと他のPWMが同じスライスを共有しています。別のスライスのGPIOを選んでください。");
    }
    return "";
  }
  const SPI_RUNTIME=`
from machine import SoftSPI
_adv_spi, _adv_cs = {}, {}
def _adv_spi_transfer(bus, data):
    tx = bytes(data)
    if len(tx) > 4096:
        raise ValueError('SPI transfer limit is 4096 bytes')
    rx = bytearray(len(tx))
    cs = _adv_cs[bus]
    cs.value(0)
    try:
        _adv_spi[bus].write_readinto(tx, rx)
    finally:
        cs.value(1)
    return rx
`;
  const PWM_RUNTIME=`
from machine import PWM
_adv_pwm = {}
def _adv_set_pwm(pin, frequency, duty):
    duty = int(duty)
    if not 0 <= duty <= 65535:
        raise ValueError('PWM duty must be 0..65535')
    if pin not in _adv_pwm:
        _adv_pwm[pin] = PWM(Pin(pin), freq=frequency, duty_u16=0)
    _adv_pwm[pin].freq(frequency)
    _adv_pwm[pin].duty_u16(duty)
def _adv_stop_pwm(pin):
    pwm = _adv_pwm.pop(pin, None)
    if pwm is not None:
        pwm.duty_u16(0)
        pwm.deinit()
        Pin(pin, Pin.OUT, value=0)
`;
  const EVENT_RUNTIME=`
import machine
_adv_irq_pins, _adv_events, _adv_timers = {}, {}, {}
_adv_polling = False
def _adv_stop_irq(pin):
    if pin in _adv_irq_pins:
        _adv_irq_pins.pop(pin).irq(handler=None)
    if pin in _adv_events:
        _adv_events[pin][0] = False
        _adv_events[pin][3] = None
def _adv_poll():
    global _adv_polling
    if _adv_polling:
        return
    _adv_polling = True
    try:
        # JOG_POLL
        for pin in _adv_events:
            event = _adv_events[pin]
            state = machine.disable_irq()
            pending = event[0]
            event[0] = False
            machine.enable_irq(state)
            now = time.ticks_ms()
            if pending and event[3] is not None and time.ticks_diff(now, event[1]) >= event[2]:
                event[1] = now
                event[3]()
        for key in list(_adv_timers):
            timer = _adv_timers.get(key)
            now = time.ticks_ms()
            if timer is not None and time.ticks_diff(now, timer[0]) >= 0:
                if timer[3]:
                    timer[0] = time.ticks_add(now, timer[1])
                else:
                    del _adv_timers[key]
                timer[2]()
    finally:
        _adv_polling = False
def _adv_wait(ms):
    # Small chunks also avoid ticks_add's half-period restriction.
    remaining = max(0, int(ms))
    while remaining:
        chunk = min(remaining, 20)
        until = time.ticks_add(time.ticks_ms(), chunk)
        while time.ticks_diff(until, time.ticks_ms()) > 0:
            _adv_poll()
            time.sleep_ms(1)
        remaining -= chunk
`;
  return {register,toolbox,expression,statement,runtime,definitions,wrap,validate,hasEvents};
})();
if(typeof module!=="undefined")module.exports=globalThis.AdvancedBlocks;
