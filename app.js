(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const PICO_PINS = [...Array.from({ length: 23 }, (_, pin) => pin), 26, 27, 28];
  const GEEK_PINS = [2, 3, 4, 5, 28, 29];
  const BOARD_PROFILES = {
    pico: {
      name: "Raspberry Pi Pico",
      pins: PICO_PINS,
      ledPin: "25",
      firmwareUrl: "https://micropython.org/download/RPI_PICO/",
      firmwareLabel: "Raspberry Pi Pico用MicroPython",
      firmwareIsZip: false,
      pinoutUrl: "https://datasheets.raspberrypi.com/pico/Pico-2-Pinout.pdf",
      layout: "pico",
      driveName: "RPI-RP2",
      boot: "USBを外し、BOOTSELボタンを押したままUSBでPCへ接続してから、ボタンを離します。",
    },
    pico2w: {
      name: "Raspberry Pi Pico 2 W",
      pins: PICO_PINS,
      ledPin: "\"LED\"",
      firmwareUrl: "https://micropython.org/download/RPI_PICO2_W/",
      firmwareLabel: "Raspberry Pi Pico 2 W用MicroPython",
      firmwareIsZip: false,
      pinoutUrl: "https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html",
      layout: "pico",
      driveName: "RP2350",
      boot: "USBを外し、BOOTSELボタンを押したままUSBでPCへ接続してから、ボタンを離します。",
    },
    rp2350_geek: {
      name: "Waveshare RP2350-GEEK",
      pins: GEEK_PINS,
      ledPin: null,
      firmwareUrl: "https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2350A-Board.zip",
      firmwareLabel: "Waveshare RP2350A用MicroPython ZIP",
      firmwareIsZip: true,
      pinoutUrl: "https://files.waveshare.com/wiki/RP2350-GEEK/RP2350-GEEK.pdf",
      layout: "geek",
      driveName: "RP2350",
      boot: "USBでPCへ接続し、BOOTとRESETを同時に押します。RESETを先に離し、次にBOOTを離します。",
    },
    rp2040_geek: {
      name: "Waveshare RP2040-GEEK",
      pins: GEEK_PINS,
      ledPin: null,
      firmwareUrl: "https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2040-Board.zip",
      firmwareLabel: "Waveshare RP2040用MicroPython ZIP",
      firmwareIsZip: true,
      pinoutUrl: "https://files.waveshare.com/wiki/RP2040-GEEK/RP2040-GEEK-Schematic.pdf",
      layout: "geek",
      driveName: "RPI-RP2",
      boot: "USBでPCへ接続し、BOOTとRESETを同時に押します。RESETを先に離し、次にBOOTを離します。",
    },
  };
  let selectedBoard = localStorage.getItem("picoblocks-board-v1");
  if (!BOARD_PROFILES[selectedBoard]) selectedBoard = "pico";

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
    boardSelect: $("#boardSelect"),
    boardPinHint: $("#boardPinHint"),
    firmwareSteps: $("#firmwareSteps"),
    firmwareLink: $("#firmwareLink"),
    appShell: $("#appShell"),
    wiringToggle: $("#wiringToggle"),
    wiringContent: $("#wiringContent"),
    wiringSummary: $("#wiringSummary"),
    wiringDiagram: $("#wiringDiagram"),
    scsWiringDetails: $("#scsWiringDetails"),
    scsHelp: $("#scsHelp"),
    pinoutLink: $("#pinoutLink"),
    menuButton: $("#menuButton"),
    appMenu: $("#appMenu"),
    controllerMenuItem: $("#controllerMenuItem"),
    controllerDrawer: $("#controllerDrawer"),
    controllerClose: $("#controllerCloseButton"),
    controllerConnect: $("#controllerConnectButton"),
    controllerConnectionLabel: $("#controllerConnectionLabel"),
    controllerPortSummary: $("#controllerPortSummary"),
    jogCenter: $("#jogCenterButton"),
    jogZInline: $("#jogZInline"),
  };

  let port = null;
  let reader = null;
  let writer = null;
  let readLoopPromise = null;
  let serialBuffer = "";
  let consoleStarted = false;
  let isBusy = false;
  const waiters = new Set();
  let controllerActive = false;
  let controllerConfigSignature = "";
  const controllerValues = { X: 511, Y: 511, Z: 511 };
  const controllerAxes = { X: { center: 511, step: 10 }, Y: { center: 511, step: 10 }, Z: { center: 511, step: 10 } };

  const theme = Blockly.Theme.defineTheme("picoBlocks", {
    base: Blockly.Themes.Zelos,
    componentStyles: {
      workspaceBackgroundColour: "#f8fafc",
      toolboxBackgroundColour: "#ffffff",
      toolboxForegroundColour: "#475467",
      flyoutBackgroundColour: "#eef2f6",
      flyoutForegroundColour: "#172033",
      flyoutOpacity: 1,
      scrollbarColour: "#c5ced8",
      scrollbarOpacity: 0.55,
      insertionMarkerColour: "#0f766e",
      insertionMarkerOpacity: 0.35,
      cursorColour: "#e87924",
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

  Blockly.Blocks.scs009_setup = {
    init() {
      const pinOptions = () => BOARD_PROFILES[selectedBoard].pins.map((pin) => [`GP${pin}`, String(pin)]);
      this.appendDummyInput().appendField("SCS009を接続");
      this.appendDummyInput().appendField("DATA").appendField(new Blockly.FieldDropdown(pinOptions), "PIN");
      this.appendDummyInput()
        .appendField("通信速度")
        .appendField(new Blockly.FieldDropdown([["1 Mbps", "1000000"], ["500 kbps", "500000"], ["38400 bps", "38400"]]), "BAUD");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(14);
      this.setTooltip("SCS009 / SCS0009のDATA線を、選択中の基板で外部に出ているGPIOへ直接接続します。");
    },
  };

  Blockly.Blocks.uart_controller_setup = {
    init() {
      this.appendDummyInput().appendField("PCからUART値を受信");
      this.appendDummyInput().appendField("USBシリアル接続を共用");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(262);
      this.setTooltip("書き込みに使うWeb Serial接続から、X・Y・ZのJOG値を受信します。");
    },
  };

  Blockly.defineBlocksWithJsonArray([
    {
      type: "uart_scs_bind",
      message0: "UARTの %1 軸を SCS009 ID %2 に割り当て",
      args0: [
        { type: "field_dropdown", name: "AXIS", options: [["X", "X"], ["Y", "Y"], ["Z", "Z"]] },
        { type: "field_number", name: "ID", value: 1, min: 0, max: 253, precision: 1 },
      ],
      message1: "中央 %1  増減幅 %2  速度 %3",
      args1: [
        { type: "field_number", name: "CENTER", value: 511, min: 0, max: 1023, precision: 1 },
        { type: "field_number", name: "STEP", value: 10, min: 1, max: 1023, precision: 1 },
        { type: "field_number", name: "SPEED", value: 500, min: 0, max: 1023, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 262,
      tooltip: "UARTコントローラの1軸をSCS009の位置指令へ割り当てます。",
    },
  ]);

  function buildToolbox() {
    const motionBlocks = [
      ...(BOARD_PROFILES[selectedBoard].ledPin === null ? [] : [{ kind: "block", type: "pico_led" }]),
      { kind: "block", type: "gpio_write" },
      { kind: "block", type: "wait_ms" },
    ];
    return {
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
            name: "うごき",
            colour: "#f0a65a",
            contents: motionBlocks,
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
        ],
      },
      {
        kind: "category",
        name: "UART",
        colour: "#7c6ee6",
        expanded: true,
        contents: [
          {
            kind: "category",
            name: "接続",
            colour: "#7c6ee6",
            contents: [{ kind: "block", type: "uart_controller_setup" }],
          },
          {
            kind: "category",
            name: "コントローラ",
            colour: "#7c6ee6",
            contents: [{ kind: "block", type: "uart_scs_bind" }],
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
  }

  const workspace = Blockly.inject("blocklyDiv", {
    toolbox: buildToolbox(),
    theme,
    renderer: "zelos",
    trashcan: true,
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: { controls: true, wheel: true, startScale: 0.92, maxScale: 1.4, minScale: 0.5, scaleSpeed: 1.1 },
    grid: { spacing: 24, length: 2, colour: "#d9e0e8", snap: true },
  });

  const starterState = {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "program_start",
          x: 54,
          y: 54,
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
    normalizeWorkspace();
  }

  function normalizeWorkspace() {
    for (const block of workspace.getAllBlocks(false).filter((item) => item.type === "print_text")) {
      block.dispose(true);
    }
    const starts = workspace.getAllBlocks(false).filter((block) => block.type === "program_start");
    let start = starts.shift();
    for (const extra of starts) extra.dispose(true);
    if (!start) {
      start = workspace.newBlock("program_start");
      start.initSvg();
      start.render();
      start.moveBy(54, 54);
    }
    start.setDeletable(false);
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

    def __init__(self, data_pin=2, baud=1_000_000):
        self.pin = Pin(data_pin, Pin.IN, Pin.PULL_UP)
        self.baud = int(baud)
        self.byte_time_us = (12_000_000 + self.baud - 1) // self.baud
        self.sm = rp2.StateMachine(
            0,
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
          if (BOARD_PROFILES[selectedBoard].ledPin === null) {
            piece = "# 選択中の基板では本体LEDブロックを使用しません\n";
          } else {
            piece = state === "TOGGLE" ? "led.toggle()\n" : `led.value(${state})\n`;
          }
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
          piece = `# SCS009はプログラム先頭で接続済みです\n`;
          break;
        case "uart_controller_setup":
          piece = `# UARTコントローラはプログラム先頭で接続済みです\n`;
          break;
        case "uart_scs_bind":
          piece = `# ${current.getFieldValue("AXIS")}軸をSCS009 ID ${Number(current.getFieldValue("ID"))}へ割り当て済みです\n`;
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
    const profile = BOARD_PROFILES[selectedBoard];
    const uartSetup = allBlocks.find((block) => block.type === "uart_controller_setup");
    const bindings = allBlocks.filter((block) => block.type === "uart_scs_bind");
    const usesSCS009 = allBlocks.some((block) => block.type.startsWith("scs009_"));
    const usesLed = allBlocks.some((block) => block.type === "pico_led");
    const setup = allBlocks.find((block) => block.type === "scs009_setup");
    const scsConfig = {
      pin: setup ? Number(setup.getFieldValue("PIN")) : 2,
      baud: setup ? Number(setup.getFieldValue("BAUD")) : 1000000,
    };
    const start = roots.find((block) => block.type === "program_start");
    const first = start ? start : roots.find((block) => block.previousConnection || block.nextConnection);
    let body = first ? chainToPython(first) : "print(\"ブロックを置いてください\")\n";
    const scsCode = usesSCS009
      ? `\n${SCS009_DRIVER}\nscs009 = SCS009PIO(data_pin=${scsConfig.pin}, baud=${scsConfig.baud})\n`
      : "";
    const ledCode = usesLed && profile.ledPin !== null ? `\nled = Pin(${profile.ledPin}, Pin.OUT)\n` : "";
    let uartCode = "";
    if (uartSetup) {
      const mappingLines = (setup ? bindings : []).map((block, index) => {
        const axis = block.getFieldValue("AXIS");
        const servoId = Number(block.getFieldValue("ID"));
        const speed = Number(block.getFieldValue("SPEED"));
        return `${index === 0 ? "if" : "elif"} axis == ${pyString(axis)}:\n        scs009.move(${servoId}, value, 0, ${speed})`;
      }).join("\n    ");
      uartCode = `
controller_values = {"X": 511, "Y": 511, "Z": 511}
_controller_input = select.poll()
_controller_input.register(sys.stdin, select.POLLIN)

def _apply_controller_value(axis, value):
    value = max(0, min(1023, int(value)))
    controller_values[axis] = value
    ${mappingLines || "# SCS009などへの割り当ては、ここへ追加できます\n    pass"}

def _controller_poll():
    if _controller_input.poll(0):
        parts = sys.stdin.readline().strip().split()
        if len(parts) == 3 and parts[0] == "JOG" and parts[1] in controller_values:
            try:
                _apply_controller_value(parts[1], parts[2])
            except ValueError:
                pass
`;
      body += `\n# PCからのJOG指令を待ちます\nwhile True:\n    _controller_poll()\n    time.sleep_ms(5)\n`;
    }
    const serialImports = uartSetup ? "\nimport sys\nimport select" : "";
    return `# PicoBlocks Studio が生成しました\n# Board: ${profile.name}\nfrom machine import Pin\nimport time${serialImports}\n${scsCode}${ledCode}${uartCode}\n${body}`;
  }

  const PICO_LEFT_PINS = ["GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND", "GP6", "GP7", "GP8", "GP9", "GND", "GP10", "GP11", "GP12", "GP13", "GND", "GP14", "GP15"];
  const PICO_RIGHT_PINS = ["VBUS", "VSYS", "GND", "3V3_EN", "3V3", "ADC_VREF", "GP28", "GND", "GP27", "GP26", "RUN", "GP22", "GND", "GP21", "GP20", "GP19", "GP18", "GND", "GP17", "GP16"];

  function picoBoardDrawing(profile, selectedPin) {
    const selected = selectedPin === null ? null : `GP${selectedPin}`;
    let dataPoint = null;
    const groundPoint = { x: 50, y: 64 };
    const makeSide = (pins, x, side) => pins.map((name, index) => {
      const y = 42 + index * 10.5;
      const active = name === selected;
      if (active) dataPoint = { x, y };
      const physical = side === "left" ? index + 1 : 40 - index;
      const labelX = side === "left" ? x + 8 : x - 8;
      const numberX = side === "left" ? x - 7 : x + 7;
      const anchor = side === "left" ? "start" : "end";
      const numberAnchor = side === "left" ? "end" : "start";
      return `<g class="pin-hit"><title>物理ピン ${physical}: ${name}</title><circle cx="${x}" cy="${y}" r="3.2" class="board-pin ${active ? "active" : ""}"/><text x="${labelX}" y="${y + 2.2}" text-anchor="${anchor}" class="pin-label ${active ? "active" : ""}">${name}</text><text x="${numberX}" y="${y + 2.2}" text-anchor="${numberAnchor}" class="pin-number">${physical}</text></g>`;
    }).join("");
    const board = `
      <rect x="50" y="22" width="160" height="238" rx="16" class="board-body"/>
      <rect x="104" y="14" width="52" height="22" rx="5" class="usb"/>
      <circle cx="130" cy="62" r="8" class="button-mark"/>
      <text x="130" y="65" text-anchor="middle" class="tiny-label">BOOT</text>
      <rect x="100" y="94" width="60" height="70" rx="7" class="chip"/>
      <text x="130" y="124" text-anchor="middle" class="board-title">${profile.name.includes("2") ? "PICO 2 W" : "PICO"}</text>
      <text x="130" y="139" text-anchor="middle" class="board-subtitle">RP GPIO / PIO</text>
      ${makeSide(PICO_LEFT_PINS, 50, "left")}${makeSide(PICO_RIGHT_PINS, 210, "right")}`;
    return { board, dataPoint, groundPoint };
  }

  function geekBoardDrawing(profile, selectedPin) {
    const groups = [
      { name: "H1 · 3PIN", x: 37, pins: ["GP2", "GND", "GP3"] },
      { name: "H2 · 3PIN", x: 101, pins: ["GP4", "GND", "GP5"] },
      { name: "H3 · 4PIN", x: 165, pins: ["3V3", "GP28", "GP29", "GND"] },
    ];
    const points = {};
    const grounds = {};
    const connectors = groups.map((group, groupIndex) => {
      const width = group.pins.length === 4 ? 61 : 57;
      const pins = group.pins.map((name, index) => {
        const x = group.x + 8 + index * 14;
        const y = 218;
        const pinNumber = name.startsWith("GP") ? Number(name.slice(2)) : null;
        const active = pinNumber === selectedPin;
        if (pinNumber !== null) points[pinNumber] = { x, y };
        if (name === "GND") grounds[groupIndex] = { x, y };
        return `<g class="pin-hit"><title>${group.name} / ${index + 1}番: ${name}</title><circle cx="${x}" cy="${y}" r="4.5" class="board-pin ${active ? "active" : name === "GND" ? "ground" : name === "3V3" ? "power" : ""}"/><text x="${x}" y="236" text-anchor="middle" class="pin-label ${active ? "active" : ""}">${name}</text><text x="${x}" y="247" text-anchor="middle" class="pin-number">${index + 1}</text></g>`;
      }).join("");
      return `<rect x="${group.x}" y="196" width="${width}" height="58" rx="7" class="connector-group"/><text x="${group.x + width / 2}" y="208" text-anchor="middle" class="connector-title">${group.name}</text>${pins}`;
    }).join("");
    const selectedGroup = selectedPin === 2 || selectedPin === 3 ? 0 : selectedPin === 4 || selectedPin === 5 ? 1 : 2;
    const dataPoint = selectedPin === null ? null : points[selectedPin];
    const groundPoint = grounds[selectedGroup];
    const board = `
      <rect x="27" y="24" width="206" height="242" rx="18" class="board-body"/>
      <path d="M79 24h102v20H79z" class="usb"/>
      <rect x="63" y="61" width="134" height="76" rx="8" class="lcd"/>
      <text x="130" y="91" text-anchor="middle" class="board-title">${profile.name.replace("Waveshare ", "")}</text>
      <text x="130" y="108" text-anchor="middle" class="board-subtitle">LCDはこの図では未使用</text>
      <rect x="88" y="149" width="84" height="32" rx="7" class="chip"/>
      <text x="130" y="168" text-anchor="middle" class="board-subtitle">EXTERNAL CONNECTORS</text>
      ${connectors}`;
    return { board, dataPoint, groundPoint };
  }

  function renderWiringDiagram() {
    const profile = BOARD_PROFILES[selectedBoard];
    const setup = workspace.getAllBlocks(false).find((block) => block.type === "scs009_setup");
    const selectedPin = setup ? Number(setup.getFieldValue("PIN")) : null;
    const drawing = profile.layout === "pico" ? picoBoardDrawing(profile, selectedPin) : geekBoardDrawing(profile, selectedPin);
    elements.pinoutLink.href = profile.pinoutUrl;
    elements.pinoutLink.textContent = `${profile.name}の公式ピン情報`;
    elements.wiringDiagram.classList.toggle("is-board-only", !setup);
    elements.scsWiringDetails.hidden = !setup;
    elements.scsHelp.hidden = !setup;
    elements.boardPinHint.hidden = !setup;
    const diagramStyle = `
      .board-body{fill:#edf4f7;stroke:#78909c;stroke-width:2}.usb{fill:#c7ced6;stroke:#87929e}.chip{fill:#334155;stroke:#172033}.lcd{fill:#e7f6f4;stroke:#0f766e;stroke-width:1.5}.button-mark{fill:#fff;stroke:#8796a8}.board-pin{fill:#fff;stroke:#64748b;stroke-width:1}.board-pin.active{fill:#fbbf24;stroke:#b45309;stroke-width:2}.board-pin.ground{fill:#cbd5e1}.board-pin.power{fill:#fda4af}.pin-label{fill:#475467;font:6.5px Inter,sans-serif}.pin-label.active{fill:#9a3412;font-weight:800}.pin-number{fill:#667085;font:6.2px Inter,sans-serif}.board-title{fill:#172033;font:700 10px Inter,sans-serif}.board-subtitle,.tiny-label{fill:#667085;font:6.5px Inter,sans-serif}.connector-group{fill:#fff;stroke:#cbd5e1}.connector-title{fill:#344054;font:700 6px Inter,sans-serif}.device-box{fill:#fff;stroke:#b8c2cf;stroke-width:1.5}.terminal{fill:#f8fafc;stroke:#667085}.terminal-label{fill:#344054;font:700 8px Inter,sans-serif}.caption{fill:#667085;font:7px Inter,sans-serif}.data-wire{fill:none;stroke:#d69e00;stroke-width:3}.power-wire{fill:none;stroke:#e5484d;stroke-width:3}.ground-wire{fill:none;stroke:#64748b;stroke-width:3}.pin-hit{cursor:help}`;
    if (!setup) {
      elements.wiringSummary.textContent = `${profile.name}の端子配置です。各端子へカーソルを合わせると番号を確認できます。`;
      elements.wiringDiagram.innerHTML = `
        <svg viewBox="0 0 260 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <style>${diagramStyle}</style>
          <title>${profile.name}の簡易ピン配置</title>
          ${drawing.board}
          <text x="130" y="286" text-anchor="middle" class="caption">端子へカーソルを合わせると端子番号を確認できます</text>
        </svg>`;
      return;
    }
    elements.wiringSummary.textContent = `接続ブロックの設定: GP${selectedPin}をSCS009のDATAへ接続します。`;
    elements.wiringDiagram.innerHTML = `
      <svg viewBox="0 0 260 460" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <style>${diagramStyle}</style>
        <title>${profile.name}とSCS009の簡易配線図</title>
        <path d="M${drawing.dataPoint.x} ${drawing.dataPoint.y} C235 ${drawing.dataPoint.y},70 330,112 330" class="data-wire"/>
        <path d="M${drawing.groundPoint.x} ${drawing.groundPoint.y} C238 ${drawing.groundPoint.y},75 372,112 372" class="ground-wire"/>
        <path d="M118 416 C150 416,82 351,112 351" class="power-wire"/>
        <path d="M118 434 C165 434,78 372,112 372" class="ground-wire"/>
        ${drawing.board}
        <text x="130" y="282" text-anchor="middle" class="caption">黄色で選択中: GP${selectedPin}</text>
        <rect x="112" y="306" width="136" height="82" rx="11" class="device-box"/>
        <text x="180" y="320" text-anchor="middle" class="board-title">SCS009 コネクタ</text>
        <circle cx="122" cy="330" r="6" class="terminal"/><text x="135" y="333" class="terminal-label">DATA</text>
        <circle cx="122" cy="351" r="6" class="terminal"/><text x="135" y="354" class="terminal-label">V+（外部電源）</text>
        <circle cx="122" cy="372" r="6" class="terminal"/><text x="135" y="375" class="terminal-label">GND（共通）</text>
        <rect x="12" y="398" width="106" height="52" rx="10" class="device-box"/>
        <text x="65" y="412" text-anchor="middle" class="board-title">サーボ用外部電源</text>
        <circle cx="108" cy="416" r="5" class="terminal"/><text x="101" y="419" text-anchor="end" class="terminal-label">＋</text>
        <circle cx="108" cy="434" r="5" class="terminal"/><text x="101" y="437" text-anchor="end" class="terminal-label">GND</text>
      </svg>`;
  }

  function updateBoardUi() {
    const profile = BOARD_PROFILES[selectedBoard];
    elements.boardSelect.value = selectedBoard;
    elements.boardPinHint.textContent = `SCS009 DATAで選べる端子: ${profile.pins.map((pin) => `GP${pin}`).join(" / ")}`;
    elements.firmwareLink.href = profile.firmwareUrl;
    elements.firmwareLink.textContent = `${profile.firmwareLabel}のダウンロード先を開く`;
    elements.firmwareSteps.replaceChildren();
    const steps = [
      profile.firmwareIsZip
        ? `${profile.name}用のMicroPython ZIPをリンク先からダウンロードして展開し、中のUF2ファイルを用意します。別機種用は使わないでください。`
        : `${profile.name}用のMicroPythonページを開き、最新の安定版UF2をダウンロードします。別機種用は使わないでください。`,
      profile.boot,
      `PCに「${profile.driveName}」というUSBドライブが表示されたことを確認します。`,
      "ダウンロードしたUF2ファイルを、そのUSBドライブへドラッグ＆ドロップします。コピーが終わるとボードが自動で再起動します。",
    ];
    for (const text of steps) {
      const item = document.createElement("li");
      item.textContent = text;
      elements.firmwareSteps.appendChild(item);
    }
    renderWiringDiagram();
  }

  function validateSCS009Pins() {
    const allowed = BOARD_PROFILES[selectedBoard].pins.map(String);
    for (const block of workspace.getAllBlocks(false).filter((item) => item.type === "scs009_setup")) {
      if (!allowed.includes(block.getFieldValue("PIN"))) block.setFieldValue(allowed[0], "PIN");
    }
  }

  function selectBoard(boardId) {
    if (!BOARD_PROFILES[boardId]) return;
    selectedBoard = boardId;
    localStorage.setItem("picoblocks-board-v1", selectedBoard);
    workspace.updateToolbox(buildToolbox());
    validateSCS009Pins();
    updateBoardUi();
    elements.pythonCode.textContent = generatePython();
    updateControllerUi();
  }

  function setWiringCollapsed(collapsed) {
    elements.appShell.classList.toggle("wiring-collapsed", collapsed);
    elements.wiringToggle.setAttribute("aria-expanded", String(!collapsed));
    elements.wiringToggle.title = collapsed ? "配線ガイドを開く" : "配線ガイドを閉じる";
    localStorage.setItem("picoblocks-wiring-collapsed-v1", collapsed ? "1" : "0");
    requestAnimationFrame(() => Blockly.svgResize(workspace));
  }

  let saveTimer = null;
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    const code = generatePython();
    elements.pythonCode.textContent = code;
    renderWiringDiagram();
    updateControllerUi();
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

  function getUartControllerBlock() {
    return workspace.getAllBlocks(false).find((block) => block.type === "uart_controller_setup") || null;
  }

  function getUartControllerConfig() {
    const block = getUartControllerBlock();
    if (!block) return null;
    return { transport: "usb-serial" };
  }

  function updateControllerUi() {
    const config = getUartControllerConfig();
    const hasController = Boolean(config);
    elements.controllerMenuItem.disabled = !hasController;
    elements.run.lastChild.textContent = hasController ? (controllerActive ? " 操作中" : " コントローラを開始") : " 今すぐ実行";
    if (controllerActive) elements.run.disabled = true;
    const menuHelp = elements.controllerMenuItem.querySelector("small");
    menuHelp.textContent = hasController ? "X・Y・Zを有線で操作" : "UARTブロックを置くと使えます";

    if (!hasController && elements.controllerDrawer.getAttribute("aria-hidden") === "false") closeController();
    if (!config) return;

    const nextAxes = { X: { center: 511, step: 10, label: "未割り当て" }, Y: { center: 511, step: 10, label: "未割り当て" }, Z: { center: 511, step: 10, label: "未割り当て" } };
    const hasScsSetup = workspace.getAllBlocks(false).some((block) => block.type === "scs009_setup");
    const bindings = workspace.getAllBlocks(false).filter((block) => block.type === "uart_scs_bind");
    for (const block of bindings) {
      const axis = block.getFieldValue("AXIS");
      nextAxes[axis] = {
        center: Number(block.getFieldValue("CENTER")),
        step: Number(block.getFieldValue("STEP")),
        label: `SCS009 ID ${Number(block.getFieldValue("ID"))}${hasScsSetup ? "" : "（接続未設定）"}`,
      };
    }
    const signature = JSON.stringify(nextAxes);
    if (signature !== controllerConfigSignature) {
      for (const axis of ["X", "Y", "Z"]) {
        controllerAxes[axis] = nextAxes[axis];
        controllerValues[axis] = nextAxes[axis].center;
      }
      controllerConfigSignature = signature;
    }
    elements.controllerPortSummary.textContent = port
      ? "RPボードへのWeb Serial接続を共用します"
      : "上部の「RPボードを接続」と同じ接続を使います";
    for (const axis of ["X", "Y", "Z"]) {
      $(`#jogValue${axis}`).textContent = controllerValues[axis];
      $(`#jogBinding${axis}`).textContent = nextAxes[axis].label;
    }
    elements.jogZInline.textContent = controllerValues.Z;
  }

  function setMenuOpen(open) {
    elements.appMenu.hidden = !open;
    elements.menuButton.setAttribute("aria-expanded", String(open));
  }

  function openController() {
    if (!getUartControllerBlock()) return;
    setMenuOpen(false);
    updateControllerUi();
    elements.controllerDrawer.setAttribute("aria-hidden", "false");
  }

  function closeController() {
    elements.controllerDrawer.setAttribute("aria-hidden", "true");
  }

  function updateControllerConnection() {
    elements.controllerConnectionLabel.textContent = controllerActive
      ? "コントローラ操作中"
      : port ? "RPボード 接続済み" : "RPボード 未接続";
    elements.controllerConnect.textContent = controllerActive
      ? "コントローラを停止"
      : port ? "コントローラを開始" : "RPボードを接続";
    elements.controllerConnect.classList.toggle("is-connected", controllerActive);
    const enabled = controllerActive;
    for (const button of document.querySelectorAll("[data-jog-axis]")) button.disabled = !enabled;
    elements.jogCenter.disabled = !enabled;
    updateControllerUi();
  }

  async function connectController() {
    if (!port) {
      await connect();
      return;
    }
    if (controllerActive) {
      await stopProgram();
      controllerActive = false;
      updateControllerConnection();
      return;
    }
    try {
      setBusy(true, "準備中…");
      showTab("console");
      await enterRawRepl();
      serialBuffer = "";
      await writeBytes(generatePython());
      await writeControl(0x04);
      await waitFor("OK", 3000);
      controllerActive = true;
      showToast("同じUSB接続でコントローラを開始しました。", "success");
    } catch (error) {
      controllerActive = false;
      showToast(`コントローラを開始できませんでした: ${error.message}`, "error");
    } finally {
      setBusy(false);
      updateControllerConnection();
    }
  }

  async function sendControllerValue(axis, value) {
    controllerValues[axis] = Math.max(0, Math.min(1023, Math.round(value)));
    updateControllerUi();
    if (!controllerActive || !port) return;
    try {
      await writeBytes(`JOG ${axis} ${controllerValues[axis]}\n`);
    } catch (error) {
      showToast(`UARTへ送信できませんでした: ${error.message}`, "error");
    }
  }

  function jogAxis(axis, direction) {
    sendControllerValue(axis, controllerValues[axis] + controllerAxes[axis].step * direction);
  }

  async function centerJog() {
    for (const axis of ["X", "Y", "Z"]) await sendControllerValue(axis, controllerAxes[axis].center);
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
      updateControllerConnection();
    } catch (error) {
      port = null;
      setConnection("offline", "未接続");
      updateControllerConnection();
      if (error.name !== "NotFoundError") showToast(`接続できませんでした: ${error.message}`, "error");
    }
  }

  async function disconnect() {
    const activePort = port;
    port = null;
    controllerActive = false;
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
    updateControllerConnection();
  }

  async function runProgram() {
    if (getUartControllerBlock()) {
      if (controllerActive) {
        showToast("コントローラはすでに動作中です。");
        return;
      }
      await connectController();
      return;
    }
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
    controllerActive = false;
    updateControllerConnection();
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
      controllerActive = false;
      updateControllerConnection();
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
  elements.boardSelect.addEventListener("change", () => selectBoard(elements.boardSelect.value));
  elements.wiringToggle.addEventListener("click", () => setWiringCollapsed(!elements.appShell.classList.contains("wiring-collapsed")));
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
  elements.menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(elements.appMenu.hidden);
  });
  elements.appMenu.addEventListener("click", (event) => event.stopPropagation());
  elements.controllerMenuItem.addEventListener("click", openController);
  elements.controllerClose.addEventListener("click", closeController);
  elements.controllerConnect.addEventListener("click", connectController);
  elements.jogCenter.addEventListener("click", centerJog);
  for (const button of document.querySelectorAll("[data-jog-axis]")) {
    button.addEventListener("click", () => jogAxis(button.dataset.jogAxis, Number(button.dataset.jogDirection)));
  }
  document.addEventListener("click", () => setMenuOpen(false));
  document.addEventListener("keydown", (event) => {
    if (elements.controllerDrawer.getAttribute("aria-hidden") !== "false") return;
    if (event.target.closest("input, select, textarea, button")) return;
    const commands = {
      ArrowLeft: ["X", -1], ArrowRight: ["X", 1], ArrowUp: ["Y", 1], ArrowDown: ["Y", -1],
      "[": ["Z", -1], "]": ["Z", 1],
    };
    if (event.code === "Space") {
      event.preventDefault();
      centerJog();
    } else if (commands[event.key]) {
      event.preventDefault();
      jogAxis(...commands[event.key]);
    }
  });

  navigator.serial?.addEventListener("disconnect", (event) => {
    if (event.target === port) disconnect();
  });

  window.addEventListener("resize", () => Blockly.svgResize(workspace));
  window.addEventListener("beforeunload", () => {
    localStorage.setItem("picoblocks-workspace-v1", JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
  });

  loadWorkspace();
  setWiringCollapsed(localStorage.getItem("picoblocks-wiring-collapsed-v1") === "1");
  validateSCS009Pins();
  updateBoardUi();
  elements.pythonCode.textContent = generatePython();
  setConnection("offline", "未接続");
  updateControllerConnection();
  updateControllerUi();
})();
