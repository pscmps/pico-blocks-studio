(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const elements = {
    connect: $("#connectButton"),
    run: $("#runButton"),
    save: $("#saveButton"),
    stop: $("#stopButton"),
    undo: $("#undoButton"),
    redo: $("#redoButton"),
    copy: $("#copyButton"),
    clearConsole: $("#clearConsoleButton"),
    codeTab: $("#codeTab"),
    consoleTab: $("#consoleTab"),
    codePanel: $("#codePanel"),
    consolePanel: $("#consolePanel"),
    pythonCode: $("#pythonCode"),
    serialConsole: $("#serialConsole"),
    connectionState: $("#connectionState"),
    connectionLabel: $("#connectionLabel"),
    actionHint: $("#actionHint"),
    toastRegion: $("#toastRegion"),
  };

  let port = null;
  let reader = null;
  let writer = null;
  let readLoopPromise = null;
  let serialBuffer = "";
  let consoleStarted = false;
  let isBusy = false;
  const waiters = new Set();

  const theme = Blockly.Theme.defineTheme("picoBlocks", {
    base: Blockly.Themes.Zelos,
    componentStyles: {
      workspaceBackgroundColour: "#0d1728",
      toolboxBackgroundColour: "#111d30",
      toolboxForegroundColour: "#bdc9da",
      flyoutBackgroundColour: "#162238",
      flyoutForegroundColour: "#dbe5f4",
      flyoutOpacity: 1,
      scrollbarColour: "#41516c",
      scrollbarOpacity: 0.55,
      insertionMarkerColour: "#5eead4",
      insertionMarkerOpacity: 0.35,
      cursorColour: "#ffb86b",
    },
    fontStyle: { family: "Inter, Noto Sans JP, sans-serif", weight: "600", size: 12 },
    startHats: true,
  });

  Blockly.defineBlocksWithJsonArray([
    {
      type: "program_start",
      message0: "プログラム開始",
      nextStatement: null,
      colour: 174,
      hat: "cap",
      tooltip: "この下につないだ処理から始まります。",
    },
    {
      type: "pico_led",
      message0: "本体LEDを %1",
      args0: [{ type: "field_dropdown", name: "STATE", options: [["点灯", "1"], ["消灯", "0"], ["反転", "TOGGLE"]] }],
      previousStatement: null,
      nextStatement: null,
      colour: 39,
      tooltip: "ボード上のLEDを操作します。",
    },
    {
      type: "wait_ms",
      message0: "%1 ミリ秒待つ",
      args0: [{ type: "field_number", name: "MS", value: 500, min: 0, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: 174,
    },
    {
      type: "print_text",
      message0: "%1 を表示",
      args0: [{ type: "field_input", name: "TEXT", text: "Hello Pico!" }],
      previousStatement: null,
      nextStatement: null,
      colour: 278,
    },
    {
      type: "repeat_times",
      message0: "%1 回くり返す",
      args0: [{ type: "field_number", name: "TIMES", value: 3, min: 0, precision: 1 }],
      message1: "%1",
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null,
      nextStatement: null,
      colour: 216,
    },
    {
      type: "forever_loop",
      message0: "ずっとくり返す",
      message1: "%1",
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null,
      colour: 216,
    },
    {
      type: "gpio_write",
      message0: "GP %1 を %2",
      args0: [
        { type: "field_number", name: "PIN", value: 0, min: 0, max: 29, precision: 1 },
        { type: "field_dropdown", name: "VALUE", options: [["HIGH", "1"], ["LOW", "0"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 39,
    },
    {
      type: "scs009_setup",
      message0: "SCS009 PIO通信を準備",
      message1: "DATA GP %1  PIO SM %2",
      args1: [
        { type: "field_number", name: "PIN", value: 2, min: 0, max: 29, precision: 1 },
        { type: "field_number", name: "SM", value: 0, min: 0, max: 7, precision: 1 },
      ],
      message2: "通信速度 %1",
      args2: [
        {
          type: "field_dropdown",
          name: "BAUD",
          options: [["1 Mbps", "1000000"], ["500 kbps", "500000"], ["38400 bps", "38400"]],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 14,
      tooltip: "SCS009 / SCS0009の1線式半二重通信をPIOで準備します。外部レベル変換回路が必要です。",
    },
    {
      type: "scs009_torque",
      message0: "SCS009 ID %1 のトルクを %2",
      args0: [
        { type: "field_number", name: "ID", value: 1, min: 0, max: 253, precision: 1 },
        { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 14,
      tooltip: "指定IDのトルクを有効または無効にします。",
    },
    {
      type: "scs009_move",
      message0: "SCS009 ID %1 を位置 %2 へ",
      args0: [
        { type: "field_number", name: "ID", value: 1, min: 0, max: 253, precision: 1 },
        { type: "field_number", name: "POSITION", value: 511, min: 0, max: 1023, precision: 1 },
      ],
      message1: "時間値 %1  速度値 %2",
      args1: [
        { type: "field_number", name: "TIME", value: 0, min: 0, max: 65535, precision: 1 },
        { type: "field_number", name: "SPEED", value: 500, min: 0, max: 1023, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 14,
      tooltip: "0〜1023が約0〜300°です。時間値と速度値はSCS1.1メモリーテーブルの生値です。",
    },
  ]);

  const toolbox = {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "基本",
        colour: "#27b7a7",
        expanded: true,
        contents: [
          {
            kind: "category",
            name: "はじめる",
            colour: "#27b7a7",
            contents: [{ kind: "block", type: "program_start" }],
          },
          {
            kind: "category",
            name: "うごき",
            colour: "#f0a65a",
            contents: [
              { kind: "block", type: "pico_led" },
              { kind: "block", type: "gpio_write" },
              { kind: "block", type: "wait_ms" },
            ],
          },
          {
            kind: "category",
            name: "くり返し",
            colour: "#5189e8",
            contents: [
              { kind: "block", type: "repeat_times" },
              { kind: "block", type: "forever_loop" },
            ],
          },
          {
            kind: "category",
            name: "表示",
            colour: "#a36ce0",
            contents: [{ kind: "block", type: "print_text" }],
          },
        ],
      },
      {
        kind: "category",
        name: "SCS009",
        colour: "#ff7a59",
        expanded: true,
        contents: [
          {
            kind: "category",
            name: "接続",
            colour: "#ff7a59",
            contents: [{ kind: "block", type: "scs009_setup" }],
          },
          {
            kind: "category",
            name: "動かす",
            colour: "#ff7a59",
            contents: [{ kind: "block", type: "scs009_move" }],
          },
          {
            kind: "category",
            name: "設定",
            colour: "#ff7a59",
            contents: [{ kind: "block", type: "scs009_torque" }],
          },
        ],
      },
    ],
  };

  const workspace = Blockly.inject("blocklyDiv", {
    toolbox,
    theme,
    renderer: "zelos",
    trashcan: true,
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: { controls: true, wheel: true, startScale: 0.92, maxScale: 1.4, minScale: 0.5, scaleSpeed: 1.1 },
    grid: { spacing: 24, length: 2, colour: "#24344f", snap: true },
  });

  const starterState = {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "program_start",
          x: 54,
          y: 54,
          next: {
            block: {
              type: "repeat_times",
              fields: { TIMES: 3 },
              inputs: {
                DO: {
                  block: {
                    type: "pico_led",
                    fields: { STATE: "1" },
                    next: {
                      block: {
                        type: "wait_ms",
                        fields: { MS: 400 },
                        next: {
                          block: {
                            type: "pico_led",
                            fields: { STATE: "0" },
                            next: { block: { type: "wait_ms", fields: { MS: 400 } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
              next: { block: { type: "print_text", fields: { TEXT: "できました！" } } },
            },
          },
        },
      ],
    },
  };

  function loadWorkspace() {
    try {
      const saved = localStorage.getItem("picoblocks-workspace-v1");
      Blockly.serialization.workspaces.load(saved ? JSON.parse(saved) : starterState, workspace);
    } catch (error) {
      console.warn("Saved workspace could not be loaded", error);
      Blockly.serialization.workspaces.load(starterState, workspace);
    }
  }

  function pyString(value) {
    return JSON.stringify(String(value)).replace(/\\u2028/g, "\\u2028").replace(/\\u2029/g, "\\u2029");
  }

  function indent(text, spaces = 4) {
    const pad = " ".repeat(spaces);
    return text.split("\n").filter(Boolean).map((line) => pad + line).join("\n") + (text ? "\n" : "");
  }

  const SCS009_DRIVER = `import rp2

@rp2.asm_pio(
    out_init=rp2.PIO.OUT_HIGH,
    set_init=rp2.PIO.OUT_HIGH,
    sideset_init=rp2.PIO.OUT_HIGH,
    out_shiftdir=rp2.PIO.SHIFT_RIGHT,
    autopull=False,
)
def _scs009_uart_tx():
    pull()
    set(pindirs, 1)
    set(x, 7).side(0) [7]
    label("scs_data_bits")
    out(pins, 1) [6]
    jmp(x_dec, "scs_data_bits")
    nop().side(1) [6]
    set(pindirs, 0)


class SCS009PIO:
    INST_WRITE = 0x03
    TORQUE_ENABLE = 0x28
    GOAL_POSITION_L = 0x2A

    def __init__(self, data_pin=2, sm_id=0, baud=1_000_000):
        self.pin = Pin(data_pin, Pin.IN, Pin.PULL_UP)
        self.baud = int(baud)
        self.byte_time_us = (12_000_000 + self.baud - 1) // self.baud
        self.sm = rp2.StateMachine(
            sm_id,
            _scs009_uart_tx,
            freq=self.baud * 8,
            out_base=self.pin,
            set_base=self.pin,
            sideset_base=self.pin,
        )
        self.sm.active(1)
        self.sm.exec("set(pindirs, 0)")

    @staticmethod
    def _limit(value, low, high):
        return max(low, min(high, int(value)))

    def _send(self, packet):
        for value in packet:
            self.sm.put(value)
        while self.sm.tx_fifo():
            pass
        time.sleep_us(self.byte_time_us)

    def write(self, servo_id, address, values):
        servo_id = self._limit(servo_id, 0, 253)
        params = [int(address) & 0xFF] + [int(v) & 0xFF for v in values]
        body = [servo_id, len(params) + 2, self.INST_WRITE] + params
        checksum = (~sum(body)) & 0xFF
        self._send(bytes([0xFF, 0xFF] + body + [checksum]))

    def torque(self, servo_id, enabled=True):
        self.write(servo_id, self.TORQUE_ENABLE, [1 if enabled else 0])

    def move(self, servo_id, position, time_value=0, speed_value=0):
        position = self._limit(position, 0, 1023)
        time_value = self._limit(time_value, 0, 65535)
        speed_value = self._limit(speed_value, 0, 1023)
        self.write(servo_id, self.GOAL_POSITION_L, [
            position & 0xFF, (position >> 8) & 0xFF,
            time_value & 0xFF, (time_value >> 8) & 0xFF,
            speed_value & 0xFF, (speed_value >> 8) & 0xFF,
        ])
`;

  function chainToPython(block, level = 0) {
    let code = "";
    let current = block;
    while (current) {
      let piece = "";
      switch (current.type) {
        case "program_start":
          break;
        case "pico_led": {
          const state = current.getFieldValue("STATE");
          piece = state === "TOGGLE" ? "led.toggle()\n" : `led.value(${state})\n`;
          break;
        }
        case "wait_ms":
          piece = `time.sleep_ms(${Math.max(0, Number(current.getFieldValue("MS")) || 0)})\n`;
          break;
        case "print_text":
          piece = `print(${pyString(current.getFieldValue("TEXT"))})\n`;
          break;
        case "gpio_write":
          piece = `Pin(${Number(current.getFieldValue("PIN"))}, Pin.OUT).value(${current.getFieldValue("VALUE")})\n`;
          break;
        case "scs009_setup":
          piece = `# SCS009 PIO通信はプログラム先頭で準備済みです\n`;
          break;
        case "scs009_torque":
          piece = `scs009.torque(${Number(current.getFieldValue("ID"))}, ${current.getFieldValue("STATE") === "1" ? "True" : "False"})\n`;
          break;
        case "scs009_move":
          piece = `scs009.move(${Number(current.getFieldValue("ID"))}, ${Number(current.getFieldValue("POSITION"))}, ${Number(current.getFieldValue("TIME"))}, ${Number(current.getFieldValue("SPEED"))})\n`;
          break;
        case "repeat_times": {
          const times = Math.max(0, Math.floor(Number(current.getFieldValue("TIMES")) || 0));
          const body = chainToPython(current.getInputTargetBlock("DO"), level + 1);
          piece = `for _ in range(${times}):\n${body ? indent(body) : "    pass\n"}`;
          break;
        }
        case "forever_loop": {
          const body = chainToPython(current.getInputTargetBlock("DO"), level + 1);
          piece = `while True:\n${body ? indent(body) : "    pass\n"}`;
          break;
        }
        default:
          piece = `# 未対応のブロック: ${current.type}\n`;
      }
      code += piece;
      current = current.getNextBlock();
    }
    return code;
  }

  function generatePython() {
    const roots = workspace.getTopBlocks(true);
    const allBlocks = workspace.getAllBlocks(false);
    const usesSCS009 = allBlocks.some((block) => block.type.startsWith("scs009_"));
    const setup = allBlocks.find((block) => block.type === "scs009_setup");
    const scsConfig = {
      pin: setup ? Number(setup.getFieldValue("PIN")) : 2,
      sm: setup ? Number(setup.getFieldValue("SM")) : 0,
      baud: setup ? Number(setup.getFieldValue("BAUD")) : 1000000,
    };
    const start = roots.find((block) => block.type === "program_start");
    const first = start ? start : roots.find((block) => block.previousConnection || block.nextConnection);
    const body = first ? chainToPython(first) : "print(\"ブロックを置いてください\")\n";
    const scsCode = usesSCS009
      ? `\n${SCS009_DRIVER}\nscs009 = SCS009PIO(data_pin=${scsConfig.pin}, sm_id=${scsConfig.sm}, baud=${scsConfig.baud})\n`
      : "";
    return `# PicoBlocks Studio が生成しました\nfrom machine import Pin\nimport time\n${scsCode}\ntry:\n    led = Pin(\"LED\", Pin.OUT)\nexcept:\n    led = Pin(25, Pin.OUT)\n\n${body}`;
  }

  let saveTimer = null;
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    const code = generatePython();
    elements.pythonCode.textContent = code;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem("picoblocks-workspace-v1", JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
    }, 250);
  });

  function showToast(message, kind = "info") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.kind = kind;
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);
    setTimeout(() => toast.remove(), 3600);
  }

  function setConnection(state, label) {
    elements.connectionState.dataset.state = state;
    elements.connectionLabel.textContent = label;
    const connected = state === "online" || state === "busy";
    elements.run.disabled = !connected || isBusy;
    elements.save.disabled = !connected || isBusy;
    elements.stop.disabled = !connected;
    elements.actionHint.textContent = connected
      ? "試運転は一時実行、保存すると次回の電源投入時にも動きます。"
      : "先に「RPボードを接続」を押してください。";
  }

  function setBusy(busy, label = "処理中…") {
    isBusy = busy;
    setConnection(busy ? "busy" : port ? "online" : "offline", busy ? label : port ? "接続済み" : "未接続");
  }

  function appendConsole(text) {
    if (!consoleStarted) {
      elements.serialConsole.textContent = "";
      consoleStarted = true;
    }
    elements.serialConsole.textContent += text;
    elements.consolePanel.scrollTop = elements.consolePanel.scrollHeight;
  }

  function notifyWaiters() {
    for (const waiter of [...waiters]) {
      if (serialBuffer.includes(waiter.pattern)) {
        waiters.delete(waiter);
        clearTimeout(waiter.timer);
        waiter.resolve(serialBuffer);
      }
    }
  }

  function waitFor(pattern, timeout = 3500) {
    if (serialBuffer.includes(pattern)) return Promise.resolve(serialBuffer);
    return new Promise((resolve, reject) => {
      const waiter = { pattern, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        waiters.delete(waiter);
        reject(new Error(`ボードからの応答を確認できませんでした: ${JSON.stringify(pattern)}`));
      }, timeout);
      waiters.add(waiter);
    });
  }

  async function readLoop() {
    while (port?.readable) {
      reader = port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          serialBuffer = (serialBuffer + text).slice(-24000);
          appendConsole(text);
          notifyWaiters();
        }
      } catch (error) {
        if (port) appendConsole(`\n[受信エラー] ${error.message}\n`);
      } finally {
        reader.releaseLock();
        reader = null;
      }
      if (port) await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async function writeBytes(bytes) {
    if (!port?.writable) throw new Error("ボードが接続されていません。");
    writer = port.writable.getWriter();
    try {
      await writer.write(bytes instanceof Uint8Array ? bytes : encoder.encode(bytes));
    } finally {
      writer.releaseLock();
      writer = null;
    }
  }

  async function writeControl(...codes) {
    await writeBytes(new Uint8Array(codes));
  }

  async function enterRawRepl() {
    serialBuffer = "";
    await writeControl(0x03, 0x03);
    await new Promise((resolve) => setTimeout(resolve, 120));
    serialBuffer = "";
    await writeControl(0x01);
    await waitFor(">");
  }

  async function executeRaw(code, timeout = 9000) {
    await enterRawRepl();
    serialBuffer = "";
    await writeBytes(code);
    await writeControl(0x04);
    await waitFor("OK", 3000);
    await waitFor("\u0004>", timeout);
    const result = serialBuffer;
    if (result.includes("Traceback (most recent call last)")) throw new Error("MicroPythonでエラーが発生しました。シリアル表示を確認してください。");
    return result;
  }

  function bytesLiteral(text) {
    const bytes = new TextEncoder().encode(text);
    let result = "b'";
    for (const byte of bytes) {
      if (byte >= 32 && byte <= 126 && byte !== 39 && byte !== 92) result += String.fromCharCode(byte);
      else result += `\\x${byte.toString(16).padStart(2, "0")}`;
    }
    return result + "'";
  }

  async function connect() {
    if (!("serial" in navigator)) {
      showToast("このブラウザーはWeb Serialに対応していません。PC版ChromeまたはEdgeを使用してください。", "error");
      return;
    }
    if (port) {
      await disconnect();
      return;
    }
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200, bufferSize: 65536 });
      readLoopPromise = readLoop();
      setConnection("online", "接続済み");
      elements.connect.lastChild.textContent = " 切断する";
      showToast("RPボードに接続しました。", "success");
      appendConsole("\n[接続しました]\n");
    } catch (error) {
      port = null;
      setConnection("offline", "未接続");
      if (error.name !== "NotFoundError") showToast(`接続できませんでした: ${error.message}`, "error");
    }
  }

  async function disconnect() {
    const activePort = port;
    port = null;
    try {
      if (reader) await reader.cancel();
      if (readLoopPromise) await readLoopPromise;
      if (activePort) await activePort.close();
    } catch (error) {
      console.warn("Disconnect warning", error);
    }
    readLoopPromise = null;
    elements.connect.lastChild.textContent = " RPボードを接続";
    setConnection("offline", "未接続");
    appendConsole("\n[切断しました]\n");
  }

  async function runProgram() {
    setBusy(true, "実行中…");
    showTab("console");
    try {
      await executeRaw(generatePython(), 30000);
      await writeControl(0x02);
      showToast("プログラムを実行しました。", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveProgram() {
    setBusy(true, "保存中…");
    showTab("console");
    try {
      const source = generatePython();
      const saveCommand = `f=open('main.py','wb')\nf.write(${bytesLiteral(source)})\nf.close()\nprint('PicoBlocks: main.py saved')\n`;
      await executeRaw(saveCommand, 12000);
      await writeControl(0x04);
      showToast("main.pyに保存しました。ボードを再起動します。", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function stopProgram() {
    try {
      await writeControl(0x03, 0x03, 0x02);
      appendConsole("\n[停止しました]\n");
      showToast("プログラムを停止しました。");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function showTab(name) {
    const showCode = name === "code";
    elements.codeTab.classList.toggle("is-active", showCode);
    elements.consoleTab.classList.toggle("is-active", !showCode);
    elements.codeTab.setAttribute("aria-selected", String(showCode));
    elements.consoleTab.setAttribute("aria-selected", String(!showCode));
    elements.codePanel.classList.toggle("is-hidden", !showCode);
    elements.consolePanel.classList.toggle("is-hidden", showCode);
    elements.copy.classList.toggle("is-hidden", !showCode);
    elements.clearConsole.classList.toggle("is-hidden", showCode);
  }

  elements.connect.addEventListener("click", connect);
  elements.run.addEventListener("click", runProgram);
  elements.save.addEventListener("click", saveProgram);
  elements.stop.addEventListener("click", stopProgram);
  elements.undo.addEventListener("click", () => workspace.undo(false));
  elements.redo.addEventListener("click", () => workspace.undo(true));
  elements.codeTab.addEventListener("click", () => showTab("code"));
  elements.consoleTab.addEventListener("click", () => showTab("console"));
  elements.copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(elements.pythonCode.textContent);
    showToast("Pythonコードをコピーしました。", "success");
  });
  elements.clearConsole.addEventListener("click", () => {
    elements.serialConsole.textContent = "";
    consoleStarted = true;
  });

  navigator.serial?.addEventListener("disconnect", (event) => {
    if (event.target === port) disconnect();
  });

  window.addEventListener("resize", () => Blockly.svgResize(workspace));
  window.addEventListener("beforeunload", () => {
    localStorage.setItem("picoblocks-workspace-v1", JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
  });

  loadWorkspace();
  elements.pythonCode.textContent = generatePython();
  setConnection("offline", "未接続");
})();
