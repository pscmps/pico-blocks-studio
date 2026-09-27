/* Editable examples using the same validated JSON format as chat imports. */
const PicoSamples = (() => {
  const shield = typeof module !== 'undefined' ? require('./shield.js') : globalThis.PlotterShield;
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === "string" ? args[0] : String.raw({raw: args[0]}, ...args.slice(1));
  const models = ["pwm", "scs009", "xl330", "sts3215", "sts3235"];
  const label = model => model === "pwm" ? t("PWMサーボ") : model.toUpperCase();
  const node = (type, fields = {}, inputs = {}) => ({type, fields, inputs: Object.fromEntries(Object.entries(inputs).map(([key, block]) => [key, {block}]))});
  const text = value => node("basic_text", {TEXT: value});
  function pins(profile) {
    const preferred = profile.platform === "esp32" ? [26, 32, 25] : [2, 4, 6];
    const selected = [];
    for (const pin of [...preferred, ...profile.pins]) {
      if (!profile.pins.includes(pin) || selected.includes(pin)) continue;
      if (profile.platform !== "esp32" && selected.some(other => other % 16 === pin % 16)) continue;
      selected.push(pin);
      if (selected.length === 3) return selected;
    }
    throw new Error(t("このボードでは3台分のサンプル用GPIOを選べません。"));
  }
  function create(board, profile, model, transport) {
    if(profile.shield)throw new Error(t('Motor Shieldでは下のGcodeサンプルを使用してください。'));
    if (!models.includes(model) || !["usb", "wifi"].includes(transport)) throw new Error(t("サンプルの種類を選び直してください。"));
    if (transport === "wifi" && !profile.wifi) throw new Error(t("このボードはWi-Fi JOGに対応していません。"));
    const gpio = pins(profile), pwm = model === "pwm", scs = model === "scs009";
    const items = [];
    if (pwm) gpio.forEach((pin, i) => items.push(node("pwm_setup", {PIN: String(pin), CHANNEL: i + 1, MIN_US: 1000, MAX_US: 2000})));
    else items.push(node(model + "_setup", {PIN: String(gpio[0]), BAUD: model === "xl330" ? "57600" : "1000000"}));
    items.push(node(transport === "wifi" ? "wifi_jog_setup" : "uart_controller_setup", transport === "wifi" ? {SSID: "PicoBlocks-JOG", PASSWORD: "picoblocks"} : {}));
    ["Y", "X", "Z"].forEach((axis, i) => items.push(node(scs ? "uart_scs_bind" : model + "_bind", {
      AXIS: axis, ID: i + 1, CENTER: pwm ? 90 : scs ? 511 : 2048, STEP: pwm ? 2 : 10,
    })));
    // Torque is enabled only when the user explicitly runs the loaded program.
    if (!pwm) for (let id = 1; id <= 3; id++) items.push(node(model + "_torque", {ID: id, STATE: "1"}));
    if (["rp2040_geek", "rp2350_geek"].includes(board)) {
      const lines = [model.toUpperCase(), "USB JOG: READY", `Y U/D: ${pwm ? "PWM" : "ID"}1`, `X L/R: ${pwm ? "PWM" : "ID"}2`, `Z W/S: ${pwm ? "PWM" : "ID"}3`, "SPACE: CENTER"];
      items.push(node("lcd_clear"));
      lines.forEach((line, i) => items.push(node("lcd_line", {ROW: i + 1}, {VALUE: text(line)})));
    }
    items.push(node("basic_print", {}, {VALUE: text(`${model.toUpperCase()} x3 / ${transport.toUpperCase()} JOG`)}));
    const first = [node("program_start"), ...items].reduceRight((next, block) => ({...block, ...(next ? {next: {block: next}} : {})}), null);
    return {format: "picoblocks", version: 1, board, workspace: {blocks: {languageVersion: 0, blocks: [first]}}};
  }
  function plotterflow(board='pico2') {
    const carrier=shield.carrier(board);
    if(!['pico2','pico2w',...shield.boardKeys].includes(board))throw new Error('Unsupported PlotterFlow sample board');
    const get=()=>node('basic_get',{NAME:'gcode_line'});
    const chain=(...items)=>items.reduceRight((next,b)=>({...b,...(next?{next:{block:next}}:{})}),null);
    const first=chain(node('program_start'),
      node('gcode_planner',{X:80,Y:80}),
      ...(carrier?[node('gcode_shield',{CARRIER:carrier,FREQ:50,UP:1000,DOWN:1800})]:[
        node('gcode_stepper',{X_STEP:'2',Y_STEP:'3',X_DIR:'4',Y_DIR:'5',ENABLE:'7',ACTIVE_LOW:'1'}),
        node('gcode_pen',{PIN:'12',FREQ:50,UP:1000,DOWN:1800})]),
      node('gcode_controller'),
      node('basic_print',{}, {VALUE:node('gcode_ready',{BOARD:board+'-stepdir'})}),
      node('forever_loop',{}, {DO:chain(
        node('basic_set',{NAME:'gcode_line'},{VALUE:node('gcode_read')}),
        node('basic_if',{}, {IF:node('adv_convert',{TYPE:'bool'},{VALUE:get()}),DO:node('basic_print',{}, {VALUE:node('gcode_reply',{}, {LINE:get()})})})
      )}));
    return {format:'picoblocks',version:1,board,workspace:{blocks:{languageVersion:0,blocks:[first]}}};
  }
  return {models, label, pins, create, plotterflow};
})();
if (typeof module !== "undefined") module.exports = PicoSamples;
