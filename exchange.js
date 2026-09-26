/* Declarative block exchange only. Never evaluates pasted JavaScript or Python. */
const BlockExchange = (() => {
  const guideUrl = "https://raw.githubusercontent.com/pscmps/pico-blocks-studio/main/AI_GUIDE.md";
  const siteUrl = "https://pscmps.github.io/pico-blocks-studio/";
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  function catalog(Blockly, toolbox) {
    const types = new Set(["program_start", "repeat_times"]);
    const walk = items => items.forEach(item => { if (item.type) types.add(item.type); if (item.contents) walk(item.contents); });
    walk(toolbox.contents);
    const scratch = new Blockly.Workspace();
    const result = {};
    try {
      for (const type of types) {
        const block = scratch.newBlock(type);
        const fields = {}, inputs = {};
        for (const input of block.inputList) {
          for (const field of input.fieldRow.filter(field => field.name)) {
            const initial = field.getValue();
            const entry = {default: initial};
            if (field instanceof Blockly.FieldDropdown) entry.options = field.getOptions(false).map(([, value]) => value);
            else if (field instanceof Blockly.FieldNumber) {
              entry.number = true;
              if (Number.isFinite(field.getMin())) entry.min = field.getMin();
              if (Number.isFinite(field.getMax())) entry.max = field.getMax();
              if (field.getPrecision()) entry.precision = field.getPrecision();
            } else entry.text = true;
            fields[field.name] = entry;
          }
          if (input.connection) inputs[input.name] = {kind: input.type === Blockly.inputs.inputTypes.STATEMENT ? "statement" : "value", check: input.connection.getCheck()};
        }
        result[type] = {label: block.toString(), fields, inputs, previous: Boolean(block.previousConnection), next: Boolean(block.nextConnection), output: block.outputConnection ? {check: block.outputConnection.getCheck()} : null};
        block.dispose();
      }
    } finally { scratch.dispose(); }
    return result;
  }
  function parse(text, profiles, getCatalog) {
    if (text.length > 300000) throw new Error("JSONは300 KB以内にしてください。");
    const cleanText = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
    let data;
    try { data = JSON.parse(cleanText); } catch { throw new Error("JSONを読み取れません。返答のJSON部分だけを貼り付けてください。"); }
    if (!object(data) || data.format !== "picoblocks" || data.version !== 1 || !Object.hasOwn(profiles, data.board)) throw new Error("format・version・boardを確認してください（PicoBlocks形式 v1）。");
    const roots = data.workspace?.blocks?.blocks;
    if (data.workspace?.blocks?.languageVersion !== 0 || !Array.isArray(roots) || roots.length !== 1 || roots[0]?.type !== "program_start") throw new Error("プログラム開始を1個だけ、一番上に置いて全処理をつないでください。");
    const schema = getCatalog(data.board);
    let count = 0;
    const fail = message => { throw new Error(message); };
    const compatible = (a, b) => !a || !b || a.some(type => b.includes(type));
    function node(raw, depth = 0, root = false) {
      if (++count > 500 || depth > 80) fail("ブロックは500個以内、接続の深さは80段以内にしてください。");
      if (!object(raw) || typeof raw.type !== "string" || !Object.hasOwn(schema, raw.type)) fail("未対応のブロック: " + String(raw?.type));
      if (!root && raw.type === "program_start") fail("プログラム開始は1個だけです。");
      const spec = schema[raw.type];
      for (const key of Object.keys(raw)) if (!["type","fields","inputs","next","x","y","id"].includes(key)) fail(raw.type + ": 未対応の項目 " + key);
      const out = {type: raw.type};
      if (root) {out.x = 54; out.y = 54;}
      if (raw.fields !== undefined) {
        if (!object(raw.fields)) fail(raw.type + ": fieldsはオブジェクトにしてください。");
        out.fields = {};
        for (const [name, value] of Object.entries(raw.fields)) {
          if (!Object.hasOwn(spec.fields, name)) fail(raw.type + ": 不明なフィールド " + name);
          const field = spec.fields[name];
          if (field.number) {
            if (typeof value !== "number" || !Number.isFinite(value) || value < (field.min ?? -Infinity) || value > (field.max ?? Infinity) || (field.precision && Math.abs(value / field.precision - Math.round(value / field.precision)) > 1e-8)) fail(raw.type + ": " + name + " の数値・範囲を確認してください。");
          } else if (typeof value !== "string" || value.length > 2000 || (field.options && !field.options.includes(value))) fail(raw.type + ": " + name + " の選択値を確認してください。");
          out.fields[name] = value;
        }
      }
      if (raw.inputs !== undefined) {
        if (!object(raw.inputs)) fail(raw.type + ": inputsはオブジェクトにしてください。");
        out.inputs = {};
        for (const [name, input] of Object.entries(raw.inputs)) {
          if (!Object.hasOwn(spec.inputs, name) || !object(input) || Object.keys(input).some(key => !["block","shadow"].includes(key)) || (!input.block && !input.shadow)) fail(raw.type + ": 入力 " + name + " を確認してください。");
          if (input.block && input.shadow) fail(raw.type + ": " + name + " はblockまたはshadowの片方だけにしてください。");
          out.inputs[name] = {};
          for (const key of ["shadow", "block"]) if (input[key]) {
            const child = node(input[key], depth + 1);
            const target = schema[child.type], slot = spec.inputs[name];
            if (slot.kind === "statement" ? !target.previous || key === "shadow" : !target.output || !compatible(slot.check, target.output.check)) fail(raw.type + ": " + name + " にこの種類のブロックは入りません。");
            out.inputs[name][key] = child;
          }
        }
      }
      if (raw.next !== undefined) {
        if (!spec.next || !object(raw.next) || Object.keys(raw.next).some(key => key !== "block") || !raw.next.block) fail(raw.type + ": 次のブロックを接続できません。");
        const next = node(raw.next.block, depth + 1);
        if (!schema[next.type].previous) fail(raw.type + ": 値ブロックはnextではなくinputsに入れてください。");
        out.next = {block: next};
      }
      return out;
    }
    const state = {blocks: {languageVersion: 0, blocks: [node(roots[0], 0, true)]}};
    return {board: data.board, workspace: state, count};
  }
  function prompt(boardId, board, schema) {
    return `PicoBlocks Studio用のプログラムを作ってください。出力はPythonではなく、下記仕様のブロックJSONです。\nアプリ: ${siteUrl}\n仕様: ${guideUrl}\n仕様を開けない場合も、このプロンプト内のカタログに従ってください。\n\n【作りたい動き】\n（ここに目的、配線、サーボの種類・ID、動作範囲を書いてください）\n\nボード: ${board.name}\nboard ID: ${boardId}\nGPIO番号: ${board.pins.join(", ")}\nADC用GPIO: ${board.pins.filter(pin => pin >= 26 && pin <= 29).join(", ")}（0〜3.3 V、5 V不可）\n\n返答はJSONコードブロック1つだけ。外部スクリプト、Python、XMLは不可。format="picoblocks", version=1, board="${boardId}"。workspace.blocks.languageVersion=0、workspace.blocks.blocksはprogram_start 1個のみ。処理はnext.blockで直列にし、値や条件やループ内処理はinputs.入力名.blockで入れる。数値フィールドは数値、選択フィールドはoptionsと同じ文字列。不要なid/extraState/mutation/enabled等は出さない。型の合うブロックのみ接続し、500個・深さ80段以内。\n接続ブロックはプログラム直下に置く。各バスサーボは接続1個、PIO通信は最大2種類、PWMの番号とGPIOは重複不可。サーボとADC/GPIOのピンは共用しない。サーボは外部電源と共通GNDが必要。接続だけで動作を始めないようにし、トルクONや位置指令の必要性を検討する。角度と生位置の単位を混同しない。SCS009は0〜1023（約300度）、XL330/STS3215は0〜4095、PWMは0〜180度。\n変数はNAMEの文字列を一致させる。basic_mapは入力範囲を出力範囲へ変換し上下限で制限する。Wi-Fiのパスワードは実際の秘密情報を要求せず仮値にする。\n\n最小例:\n${JSON.stringify({format:"picoblocks",version:1,board:boardId,workspace:{blocks:{languageVersion:0,blocks:[{type:"program_start",next:{block:{type:"basic_wait",inputs:{MS:{block:{type:"basic_number",fields:{NUM:500}}}}}}}]}}},null,2)}\n\n使用可能なブロック（fieldsはdefault/範囲/選択肢、inputsは名前/接続種別/型、outputは値型。defaultは省略時の値）:\n${JSON.stringify(schema,null,2)}`;
  }
  return {catalog, parse, prompt, guideUrl};
})();
if (typeof module !== "undefined") module.exports = BlockExchange;
