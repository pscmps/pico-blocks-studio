/* Small, explicit block vocabulary, also usable by external chat tools. */
const BasicBlocks = (() => {
  const number = (name, value) => ({type:"field_number", name, value});
  const value = (name, check="Number") => ({type:"input_value", name, ...(check ? {check} : {})});
  const choice = (name, options) => ({type:"field_dropdown", name, options});
  const variable = () => ({type:"field_input", name:"NAME", text:"値"});
  const stmt = (type, message0, args0, extra={}) => ({type, message0, args0, previousStatement:null, nextStatement:null, colour:180, ...extra});
  const expr = (type, message0, args0, output="Number", extra={}) => ({type, message0, args0, output, colour:225, inputsInline:true, ...extra});
  const definitions = [
    expr("basic_number", "%1", [number("NUM", 0)]),
    expr("basic_math", "%1 %2 %3", [value("A"), choice("OP", [["＋","ADD"],["−","SUB"],["×","MUL"],["÷","DIV"],["余り","MOD"]]), value("B")]),
    expr("basic_unary", "%1 %2", [choice("OP", [["絶対値","ABS"],["整数へ丸める","ROUND"],["切り捨て","FLOOR"],["平方根","SQRT"]]), value("VALUE")]),
    expr("basic_limit", "%1 を %2 〜 %3 に収める", [value("VALUE"),value("MIN"),value("MAX")]),
    expr("basic_map", "%1 の範囲を変換", [value("VALUE")], "Number", {message1:"入力 %1 〜 %2 → 出力 %3 〜 %4",args1:[value("IN_MIN"),value("IN_MAX"),value("OUT_MIN"),value("OUT_MAX")], inputsInline:false, tooltip:"入力範囲外は出力の上下限で止めます。入力の上下限を同じ値にしないでください。"}),
    expr("basic_random", "%1 〜 %2 の整数乱数", [value("MIN"),value("MAX")]),
    expr("basic_compare", "%1 %2 %3", [value("A"),choice("OP",[["＝","EQ"],["≠","NE"],["＜","LT"],["≤","LE"],["＞","GT"],["≥","GE"]]),value("B")], "Boolean",{colour:210}),
    expr("basic_boolean", "%1", [choice("VALUE",[["真","TRUE"],["偽","FALSE"]])], "Boolean",{colour:210}),
    expr("basic_logic", "%1 %2 %3", [value("A","Boolean"),choice("OP",[["かつ","AND"],["または","OR"]]),value("B","Boolean")], "Boolean",{colour:210}),
    expr("basic_not", "%1 ではない", [value("VALUE","Boolean")], "Boolean",{colour:210}),
    expr("basic_get", "変数 %1", [variable()], null,{colour:300}),
    stmt("basic_set", "変数 %1 を %2 にする", [variable(),value("VALUE",null)],{colour:300}),
    stmt("basic_change", "変数 %1 を %2 増やす", [variable(),value("VALUE")],{colour:300}),
    stmt("basic_if", "もし %1 なら", [value("IF","Boolean")],{colour:210,message1:"%1",args1:[{type:"input_statement",name:"DO"}],message2:"そうでなければ %1",args2:[{type:"input_statement",name:"ELSE"}]}),
    stmt("basic_repeat", "%1 回くり返す", [value("TIMES")],{colour:210,message1:"%1",args1:[{type:"input_statement",name:"DO"}]}),
    stmt("basic_while", "%1 の間くり返す", [value("IF","Boolean")],{colour:210,message1:"%1",args1:[{type:"input_statement",name:"DO"}]}),
    stmt("basic_wait", "%1 ミリ秒待つ", [value("MS")]),
    expr("basic_ticks", "起動からのミリ秒", [], "Number",{tooltip:"カウンタには折り返しがあります。時間差ブロックで比較してください。"}),
    expr("basic_elapsed", "%1 から %2 までの時間差（ms）", [value("START"),value("END")]),
    expr("basic_text", "%1", [{type:"field_input",name:"TEXT",text:"Hello!"}], "String",{colour:270}),
    expr("basic_join", "%1 と %2 をつなぐ", [value("A",null),value("B",null)], "String",{colour:270}),
    stmt("basic_print", "%1 をUSBシリアルへ表示", [value("VALUE",null)],{colour:270,tooltip:"LCDではなくPCのシリアル欄へ表示します。"}),
  ];
  function register(Blockly, pinOptions, adcOptions) {
    Blockly.defineBlocksWithJsonArray(definitions);
    for (const kind of ["adc", "read", "write"]) {
      Blockly.Blocks["basic_"+kind] = {init() {
        this.appendDummyInput().appendField(kind === "adc" ? "ADC" : "GPIO").appendField(new Blockly.FieldDropdown(kind === "adc" ? adcOptions : pinOptions),"PIN");
        if (kind === "adc") {
          this.appendDummyInput().appendField(new Blockly.FieldDropdown([["値 0〜65535","RAW"],["電圧（V）","VOLT"]]),"MODE");
          this.setOutput(true,"Number");
          this.setTooltip("入力は0〜3.3 Vのみ。電圧は基準3.3 Vと仮定した概算です。5 Vは接続しないでください。");
        } else if (kind === "read") {
          this.appendDummyInput().appendField("を読む").appendField(new Blockly.FieldDropdown([["プルアップ","UP"],["プルダウン","DOWN"],["なし","NONE"]]),"PULL");
          this.setOutput(true,"Number");
        } else {
          this.appendValueInput("VALUE").setCheck(["Number","Boolean"]).appendField("に出力（0/1）");
          this.setPreviousStatement(true); this.setNextStatement(true);
        }
        this.setColour(39);
      }};
    }
    for (const model of ["pwm", "scs009", "xl330", "sts3215"]) {
      const isPwm = model === "pwm";
      Blockly.defineBlocksWithJsonArray([stmt(model+"_value", `${isPwm ? "PWMサーボ" : model.toUpperCase()} ${isPwm ? "番号" : "ID"} %1 を %2 ${isPwm ? "°へ" : "の位置へ"}`, [{type:"field_number",name:isPwm?"CHANNEL":"ID",value:1,min:isPwm?1:0,max:isPwm?16:model==="xl330"?252:253,precision:1},value("VALUE")],{colour:isPwm?42:14,tooltip:"計算・変数・ADCの値をつなげます。サーボの接続・トルク設定は別ブロックです。"})]);
    }
  }
  const shadow = n => ({shadow:{type:"basic_number",fields:{NUM:n}}});
  const entry = (type, inputs={}) => ({kind:"block",type,inputs});
  function toolbox() {
    const category = (name, colour, contents) => ({kind:"category",name,colour,contents});
    return [
      category("入力・出力", "#bd903c", [entry("basic_adc"),entry("basic_read"),entry("basic_write",{VALUE:shadow(1)})]),
      category("計算", "#527baa", [entry("basic_number"),entry("basic_math",{A:shadow(1),B:shadow(2)}),entry("basic_unary",{VALUE:shadow(-10)}),entry("basic_limit",{VALUE:shadow(90),MIN:shadow(0),MAX:shadow(180)}),entry("basic_map",{VALUE:shadow(0),IN_MIN:shadow(0),IN_MAX:shadow(65535),OUT_MIN:shadow(0),OUT_MAX:shadow(180)}),entry("basic_random",{MIN:shadow(0),MAX:shadow(100)})]),
      category("条件・論理", "#6885b2", [entry("basic_if"),entry("basic_compare",{A:shadow(0),B:shadow(100)}),entry("basic_boolean"),entry("basic_logic"),entry("basic_not")]),
      category("変数", "#ac71a3", [entry("basic_set",{VALUE:shadow(0)}),entry("basic_get"),entry("basic_change",{VALUE:shadow(1)})]),
      category("時間・くり返し", "#598ea4", [entry("basic_wait",{MS:shadow(100)}),entry("basic_ticks"),entry("basic_elapsed"),entry("basic_repeat",{TIMES:shadow(10)}),entry("basic_while"),entry("forever_loop")]),
      category("文字・シリアル", "#9673ac", [entry("basic_text"),entry("basic_join"),entry("basic_print",{VALUE:{shadow:{type:"basic_text",fields:{TEXT:"Hello!"}}}})]),
    ];
  }
  const variableName = name => "user_" + Array.from(String(name)).map(c=>c.codePointAt(0).toString(16)).join("_");
  function expression(block, fallback="0") {
    if (!block) return fallback;
    const f = n => block.getFieldValue(n);
    const input = (n, d="0") => expression(block.getInputTargetBlock(n), d);
    const op = (map, key) => {if (!map[key]) throw new Error("未対応の演算子です"); return map[key];};
    switch(block.type) {
      case "basic_number": return String(Number(f("NUM")) || 0);
      case "basic_math": return `(${input("A")} ${op({ADD:"+",SUB:"-",MUL:"*",DIV:"/",MOD:"%"},f("OP"))} ${input("B","1")})`;
      case "basic_unary": return `${op({ABS:"abs",ROUND:"round",FLOOR:"math.floor",SQRT:"math.sqrt"},f("OP"))}(${input("VALUE")})`;
      case "basic_limit": return `max(${input("MIN")}, min(${input("MAX","180")}, ${input("VALUE")}))`;
      case "basic_map": return `_map_range(${input("VALUE")}, ${input("IN_MIN")}, ${input("IN_MAX","65535")}, ${input("OUT_MIN")}, ${input("OUT_MAX","180")})`;
      case "basic_random": return `random.randint(int(${input("MIN")}), int(${input("MAX","100")}))`;
      case "basic_compare": return `(${input("A")} ${op({EQ:"==",NE:"!=",LT:"<",LE:"<=",GT:">",GE:">="},f("OP"))} ${input("B")})`;
      case "basic_boolean": return f("VALUE")==="TRUE" ? "True" : "False";
      case "basic_logic": return `(${input("A","False")} ${f("OP")==="AND"?"and":"or"} ${input("B","False")})`;
      case "basic_not": return `(not ${input("VALUE","False")})`;
      case "basic_get": return variableName(f("NAME"));
      case "basic_ticks": return "time.ticks_ms()";
      case "basic_elapsed": return `time.ticks_diff(${input("END","time.ticks_ms()")}, ${input("START")})`;
      case "basic_adc": return `(_adc_${f("PIN")}.read_u16()${f("MODE")==="VOLT"?" * 3.3 / 65535":""})`;
      case "basic_read": return `_input_${f("PIN")}.value()`;
      case "basic_text": return JSON.stringify(String(f("TEXT")));
      case "basic_join": return `(str(${input("A","''")}) + str(${input("B","''")}))`;
      default: throw new Error("値として使えないブロック: " + block.type);
    }
  }
  function statement(block, chain, indent, jog) {
    const f = n => block.getFieldValue(n);
    const input = (n,d="0") => expression(block.getInputTargetBlock(n),d);
    const body = n => indent(chain(block.getInputTargetBlock(n))) || "    pass\n";
    switch(block.type) {
      case "basic_set": return `${variableName(f("NAME"))} = ${input("VALUE")}\n`;
      case "basic_change": return `${variableName(f("NAME"))} += ${input("VALUE","1")}\n`;
      case "basic_write": return `_output_${f("PIN")}.value(1 if ${input("VALUE")} else 0)\n`;
      case "basic_print": return `print(${input("VALUE","''")})\n`;
      case "basic_wait": return `${jog ? "_controller_wait" : "time.sleep_ms"}(max(0, int(${input("MS","100")})))\n`;
      case "basic_if": return `if ${input("IF","False")}:\n${body("DO")}else:\n${body("ELSE")}`;
      case "basic_repeat": return `for _ in range(max(0, int(${input("TIMES","10")}))):\n${jog?"    _controller_poll()\n":""}${body("DO")}`;
      case "basic_while": return `while ${input("IF","False")}:\n${jog?"    _controller_poll()\n":""}    time.sleep_ms(1)\n${body("DO")}`;
      case "pwm_value": return `pwm_servos[${Number(f("CHANNEL"))}].angle(${input("VALUE","90")})\n`;
      case "scs009_value": return `scs009.move(${Number(f("ID"))}, int(${input("VALUE","511")}), 0, 500)\n`;
      case "xl330_value": return `xl330.move(${Number(f("ID"))}, int(${input("VALUE","2048")}), 20, 20)\n`;
      case "sts3215_value": return `sts3215.move(${Number(f("ID"))}, int(${input("VALUE","2048")}), 500, 20)\n`;
      default: return null;
    }
  }
  function runtime(blocks) {
    let code = "";
    const types = new Set(blocks.map(b=>b.type));
    if (types.has("basic_unary")) code += "import math\n";
    if (types.has("basic_random")) code += "import random\n";
    if (types.has("basic_adc")) code += "from machine import ADC\n";
    const lines = new Set();
    for (const b of blocks) {
      const pin = Number(b.getFieldValue("PIN"));
      if (b.type === "basic_adc") lines.add(`_adc_${pin} = ADC(Pin(${pin}))`);
      if (b.type === "basic_read") lines.add(`_input_${pin} = Pin(${pin}, Pin.IN${({UP:", Pin.PULL_UP",DOWN:", Pin.PULL_DOWN",NONE:""})[b.getFieldValue("PULL")]})`);
      if (b.type === "basic_write") lines.add(`_output_${pin} = Pin(${pin}, Pin.OUT, value=0)`);
      if (["basic_get","basic_set","basic_change"].includes(b.type)) lines.add(`${variableName(b.getFieldValue("NAME"))} = 0`);
    }
    code += [...lines].join("\n") + "\n";
    if (types.has("basic_map")) code += `
def _map_range(value, in_min, in_max, out_min, out_max):
    if in_min == in_max:
        raise ValueError('Range input limits must differ')
    ratio = max(0, min(1, (value - in_min) / (in_max - in_min)))
    return out_min + ratio * (out_max - out_min)
`;
    return code;
  }
  return {register,toolbox,expression,statement,runtime,variableName};
})();
if (typeof module !== "undefined") module.exports = BasicBlocks;
