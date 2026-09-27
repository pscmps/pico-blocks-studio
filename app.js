(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const PICO_PINS = [...Array.from({ length: 23 }, (_, pin) => pin), 26, 27, 28];
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === "string" ? args[0] : String.raw({raw: args[0]}, ...args.slice(1));
  const GEEK_PINS = [2, 3, 4, 5, 28, 29];
  function createBoardProfiles() {
  const BOARD_PROFILES = {
    pico: {
      name: "Raspberry Pi Pico",
      pins: PICO_PINS,
      ledPin: "25",
      firmwareUrl: "https://micropython.org/download/RPI_PICO/",
      firmwareLabel: t("Raspberry Pi Pico用MicroPython"),
      firmwareIsZip: false,
      pinoutUrl: "https://datasheets.raspberrypi.com/pico/Pico-2-Pinout.pdf",
      layout: "pico",
      driveName: "RPI-RP2",
      boot: t("USBを外し、BOOTSELボタンを押したままUSBでPCへ接続してから、ボタンを離します。"),
    },
    pico2w: {
      name: "Raspberry Pi Pico 2 W",
      pins: PICO_PINS,
      ledPin: "\"LED\"",
      firmwareUrl: "https://micropython.org/download/RPI_PICO2_W/",
      firmwareLabel: t("Raspberry Pi Pico 2 W用MicroPython"),
      firmwareIsZip: false,
      pinoutUrl: "https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html",
      layout: "pico",
      driveName: "RP2350",
      boot: t("USBを外し、BOOTSELボタンを押したままUSBでPCへ接続してから、ボタンを離します。"),
    },
    rp2350_geek: {
      name: "Waveshare RP2350-GEEK",
      pins: GEEK_PINS,
      ledPin: null,
      firmwareUrl: "https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2350A-Board.zip",
      firmwareLabel: t("Waveshare RP2350A用MicroPython ZIP"),
      firmwareIsZip: true,
      pinoutUrl: "https://files.waveshare.com/wiki/RP2350-GEEK/RP2350-GEEK.pdf",
      layout: "geek",
      driveName: "RP2350",
      boot: t("USBでPCへ接続し、BOOTとRESETを同時に押します。RESETを先に離し、次にBOOTを離します。"),
    },
    rp2040_geek: {
      name: "Waveshare RP2040-GEEK",
      pins: GEEK_PINS,
      ledPin: null,
      firmwareUrl: "https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2040-Board.zip",
      firmwareLabel: t("Waveshare RP2040用MicroPython ZIP"),
      firmwareIsZip: true,
      pinoutUrl: "https://files.waveshare.com/wiki/RP2040-GEEK/RP2040-GEEK-Schematic.pdf",
      layout: "geek",
      driveName: "RPI-RP2",
      boot: t("USBでPCへ接続し、BOOTとRESETを同時に押します。RESETを先に離し、次にBOOTを離します。"),
    },
  };
  BOARD_PROFILES.picow = {
    ...BOARD_PROFILES.pico, name: "Raspberry Pi Pico W", wifi: true, ledPin: '"LED"',
    firmwareUrl: "https://micropython.org/download/RPI_PICO_W/", firmwareLabel: t("Raspberry Pi Pico W用MicroPython"),
  };
  BOARD_PROFILES.pico2 = {
    ...BOARD_PROFILES.pico2w, name: "Raspberry Pi Pico 2", ledPin: "25",
    firmwareUrl: "https://micropython.org/download/RPI_PICO2/", firmwareLabel: t("Raspberry Pi Pico 2用MicroPython"),
  };
  BOARD_PROFILES.pico2w.wifi = true;
  BOARD_PROFILES.atom_lite = {
    name: t("M5Stack ATOM Lite（開発中・動作未確認）"),
    platform: "esp32", pins: [19, 21, 22, 23, 25, 26, 32, 33], adcPins: [32, 33],
    pinLabels: Object.fromEntries([19, 21, 22, 23, 25, 26, 32, 33].map(pin => [pin, `G${pin}${pin === 26 || pin === 32 ? " (Grove)" : ""}`])),
    layout: "atom", ledPin: "27", wifi: true, experimental: true,
    firmwareUrl: "https://micropython.org/download/ESP32_GENERIC/",
    firmwareLabel: "ESP32_GENERIC MicroPython", firmwareIsZip: false,
    pinoutUrl: `https://docs.m5stack.com/${globalThis.PicoI18n?.language === "en" ? "en" : "ja"}/core/ATOM%20Lite`,
    boot: t("USBでPCへ接続し、公式ページのesptool手順で書き込みます。正面ボタンは初期ファーム用のBOOTボタンではありません。"),
  };
  for (const chip of ["rp2040", "rp2350"]) {
    const pins = chip === "rp2040" ? [26, 27, 28, 29, 6, 7, 0, 1, 2, 4, 3] : [26, 27, 28, 5, 6, 7, 0, 1, 2, 4, 3];
    BOARD_PROFILES["xiao_" + chip] = {
      name: `Seeed Studio XIAO ${chip.toUpperCase()}`, pins, layout: "xiao", ledPin: "25", ledActiveLow: true,
      pinLabels: Object.fromEntries(pins.map((pin, i) => [pin, `D${i} / GP${pin}`])),
      firmwareUrl: `https://micropython.org/download/SEEED_XIAO_${chip.toUpperCase()}/`,
      firmwareLabel: t`XIAO ${chip.toUpperCase()}用MicroPython`, firmwareIsZip: false,
      pinoutUrl: chip === "rp2350" ? "https://wiki.seeedstudio.com/xiao_rp2350_arduino/" : "https://wiki.seeedstudio.com/XIAO-RP2040/",
      driveName: chip === "rp2350" ? "RP2350" : "RPI-RP2",
      boot: t("USBを外し、XIAO本体のBOOTボタンを押したままUSB接続し、ボタンを離します。接続済みならBOOTを押しながらRESETを押して離し、最後にBOOTを離します。"),
    };
  }
  Object.assign(BOARD_PROFILES, BasicBlocks.shield.profiles(BOARD_PROFILES));
  return BOARD_PROFILES;
  }
  const BOARD_PROFILES = createBoardProfiles();
  let selectedBoard = localStorage.getItem("picoblocks-board-v1");
  if (!BOARD_PROFILES[selectedBoard]) selectedBoard = "pico";
  const pinLabel = pin => BOARD_PROFILES[selectedBoard].pinLabels?.[pin] || `GP${pin}`;
  const pinOptions = () => BOARD_PROFILES[selectedBoard].pins.map(pin => [pinLabel(pin), String(pin)]);
  const adcOptions = () => {
    const options=pinOptions().filter(([, pin]) => BOARD_PROFILES[selectedBoard].adcPins?.includes(Number(pin)) ?? (Number(pin) >= 26 && Number(pin) <= 29));
    // Keep an imported ADC block editable after switching to a board without ADC.
    // The sentinel is never allowed by validateProgram.
    return options.length?options:[[t('使用可能なADC端子なし'),'-1']];
  };

  const elements = {
    connect: $("#connectButton"),
    run: $("#runButton"),
    save: $("#saveButton"),
    stop: $("#stopButton"),
    writeMode: $("#writeModeButton"),
    boardMode: $("#boardMode"),
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
  };

  let port = null;
  let reader = null;
  let writer = null;
  let readLoopPromise = null;
  let serialBuffer = "";
  let consoleStarted = false;
  let isBusy = false;
  let boardMode = "UNKNOWN";
  function setBoardMode(mode) {
    boardMode = mode;
    elements.boardMode.textContent = ({UNKNOWN:t("モード未確認"),BOOT:t("起動待ち · BOOT受付中"),WRITE:t("書き込み待機"),RUN:t("実行中"),FINISHED:t("実行終了"),STOPPED:t("中断中（出力は要確認）")})[mode] || t("モード未確認");
  }
  const waiters = new Set();
  let controllerActive = false;
  let controllerConfigSignature = "";
  const controllerValues = { X: 511, Y: 511, Z: 511, R: 511 };
  const controllerAxes = PicoJog.defaults(false);

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

  function registerBlocks() {
  Blockly.defineBlocksWithJsonArray([
    {
      type: "program_start",
      message0: t("プログラム開始"),
      nextStatement: null,
      colour: 174,
      hat: "cap",
      tooltip: t("この下につないだ処理から始まります。"),
    },
    {
      type: "pico_led",
      message0: t("本体LEDを %1"),
      args0: [{ type: "field_dropdown", name: "STATE", options: [[t("点灯"), "1"], [t("消灯"), "0"], [t("反転"), "TOGGLE"]] }],
      previousStatement: null,
      nextStatement: null,
      colour: 39,
      tooltip: t("ボード上のLEDを操作します。"),
    },
    {
      type: "wait_ms",
      message0: t("%1 ミリ秒待つ"),
      args0: [{ type: "field_number", name: "MS", value: 500, min: 0, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: 174,
    },
    {
      type: "print_text",
      message0: t("%1 を表示"),
      args0: [{ type: "field_input", name: "TEXT", text: "Hello Pico!" }],
      previousStatement: null,
      nextStatement: null,
      colour: 278,
    },
    {
      type: "repeat_times",
      message0: t("%1 回くり返す"),
      args0: [{ type: "field_number", name: "TIMES", value: 3, min: 0, precision: 1 }],
      message1: "%1",
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null,
      nextStatement: null,
      colour: 216,
    },
    {
      type: "forever_loop",
      message0: t("ずっとくり返す"),
      message1: "%1",
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null,
      colour: 216,
    },
    {
      type: "gpio_write",
      message0: t("GP %1 を %2"),
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
      message0: t("SCS009 ID %1 のトルクを %2"),
      args0: [
        { type: "field_number", name: "ID", value: 1, min: 0, max: 253, precision: 1 },
        { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 14,
      tooltip: t("指定IDのトルクを有効または無効にします。"),
    },
    {
      type: "scs009_move",
      message0: t("SCS009 ID %1 を位置 %2 へ"),
      args0: [
        { type: "field_number", name: "ID", value: 1, min: 0, max: 253, precision: 1 },
        { type: "field_number", name: "POSITION", value: 511, min: 0, max: 1023, precision: 1 },
      ],
      message1: t("時間値 %1  速度値 %2"),
      args1: [
        { type: "field_number", name: "TIME", value: 0, min: 0, max: 65535, precision: 1 },
        { type: "field_number", name: "SPEED", value: 500, min: 0, max: 1023, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 14,
      tooltip: t("0〜1023が約0〜300°です。時間値と速度値はSCS1.1メモリーテーブルの生値です。"),
    },
  ]);

  Blockly.Blocks.scs009_setup = {
    init() {
      this.appendDummyInput().appendField(t("SCS009を接続"));
      this.appendDummyInput().appendField("DATA").appendField(new Blockly.FieldDropdown(pinOptions), "PIN");
      this.appendDummyInput()
        .appendField(t("通信速度"))
        .appendField(new Blockly.FieldDropdown([["1 Mbps", "1000000"], ["500 kbps", "500000"], ["38400 bps", "38400"]]), "BAUD");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(14);
      this.setTooltip(t("SCS009 / SCS0009のDATA用GPIOを選びます。直結の前に左の信号レベルの注意を確認してください。"));
    },
  };

  ServoBlocks.register(Blockly, pinOptions);
  BasicBlocks.register(Blockly, pinOptions, adcOptions);
  GeekDisplay.register(Blockly);

  Blockly.Blocks.uart_controller_setup = {
    init() {
      this.appendDummyInput().appendField(t("PCからUART値を受信"));
      this.appendDummyInput().appendField(t("USBシリアル接続を共用"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(262);
      this.setTooltip(t("書き込みに使うWeb Serial接続から、4軸のJOG値を受信します。"));
    },
  };

  Blockly.defineBlocksWithJsonArray([
    {
      type: "wifi_jog_setup", message0: t("Wi-Fi JOGサーバを開始"),
      message1: t("Wi-Fi名 %1"), args1: [{ type: "field_input", name: "SSID", text: "PicoBlocks-JOG" }],
      message2: t("パスワード %1"), args2: [{ type: "field_input", name: "PASSWORD", text: "picoblocks" }],
      previousStatement: null, nextStatement: null, colour: 190,
      tooltip: t("選択したWi-Fi対応ボードが親機になります。スマホでこのWi-Fiへ接続して操作します。パスワードは8〜63文字。"),
    },
    {
      type: "uart_scs_bind",
      message0: t("JOGの %1 を SCS009 ID %2 に割り当て"),
      args0: [
        { type: "field_dropdown", name: "AXIS", options: [["↑ ↓", "Y"], ["← →", "X"], ["W S", "Z"], ["A D", "R"]] },
        { type: "field_number", name: "ID", value: 1, min: 0, max: 253, precision: 1 },
      ],
      message1: t("中央 %1  増減幅 %2"),
      args1: [
        { type: "field_number", name: "CENTER", value: 511, min: 0, max: 1023, precision: 1 },
        { type: "field_number", name: "STEP", value: 10, min: 1, max: 1023, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 262,
      tooltip: t("USB／Wi-Fi共通のJOG割り当て。増減幅は1回のキー操作で動かす位置の差です。速度は内部で設定します。"),
    },
  ]);
  ServoBlocks.hideJogSpeed(Blockly, "uart_scs_bind", 500, 0, 1023);
  }
  registerBlocks();

  function buildToolbox() {
    return {
    kind: "categoryToolbox",
    contents: [
      ...(BOARD_PROFILES[selectedBoard].wifi ? [{
        kind: "category", name: "Wi-Fi JOG", colour: "#31a8b0",
        contents: [{ kind: "block", type: "wifi_jog_setup" }, { kind: "block", type: "uart_scs_bind" }],
      }] : []),
      {
        kind: "category",
        name: t("基本"),
        colour: "#27b7a7",
        expanded: true,
        contents: [
          ...BasicBlocks.toolbox(BOARD_PROFILES[selectedBoard]),
          ...GeekDisplay.toolbox(selectedBoard),
        ],
      },
      BasicBlocks.advancedToolbox(BOARD_PROFILES[selectedBoard]),
      {
        kind: "category",
        name: "UART",
        colour: "#7c6ee6",
        expanded: true,
        contents: [
          {
            kind: "category",
            name: t("接続"),
            colour: "#7c6ee6",
            contents: [{ kind: "block", type: "uart_controller_setup" }],
          },
          {
            kind: "category",
            name: t("コントローラ"),
            colour: "#7c6ee6",
            contents: [{ kind: "block", type: "uart_scs_bind" }],
          },
        ],
      },
      ...ServoBlocks.toolbox().filter(category => category.name === t("PWMサーボ")),
      {
        kind: "category",
        name: "SCS009",
        colour: "#ff7a59",
        contents: [
          { kind: "block", type: "scs009_setup" },
          { kind: "block", type: "scs009_torque" },
          { kind: "block", type: "scs009_move" },
          { kind: "block", type: "scs009_value", inputs: {VALUE: {shadow: {type: "basic_number", fields: {NUM: 511}}}} },
          { kind: "block", type: "uart_scs_bind" },
        ],
      },
      ...ServoBlocks.toolbox().filter(category => category.name !== t("PWMサーボ")),
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

  $("#blocklyDiv").addEventListener("dblclick", (event) => {
    if (event.target.closest(".blocklyEditableText, input, textarea")) return;
    const block = workspace.getAllBlocks(false).find((item) => item.getSvgRoot() === event.target.closest(".blocklyDraggable"));
    if (!block || block.type === "program_start" || !block.isDeletable() || !block.isMovable()) return;
    Blockly.Events.setGroup(true);
    try {
      const state = Blockly.serialization.blocks.save(block, { addCoordinates: true, doFullSerialization: true });
      delete state.next;
      delete state.id;
      state.x += 32;
      state.y += 32;
      Blockly.serialization.blocks.append(state, workspace, { recordUndo: true }).select();
    } finally {
      Blockly.Events.setGroup(false);
    }
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
    const events = BasicBlocks.hasEvents(workspace.getAllBlocks(false));
    let current = block;
    while (current) {
      let piece = "";
      switch (current.type) {
        case "program_start":
          break;
        case "pico_led": {
          const state = current.getFieldValue("STATE");
          if (BOARD_PROFILES[selectedBoard].ledPin === null) {
            piece = t("# 選択中の基板では本体LEDブロックを使用しません\n");
          } else {
            piece = state === "TOGGLE" ? "led.toggle()\n" : `led.value(${BOARD_PROFILES[selectedBoard].ledActiveLow ? 1 - Number(state) : state})\n`;
          }
          break;
        }
        case "wait_ms":
          piece = `${events ? "_adv_wait" : "time.sleep_ms"}(${Math.max(0, Number(current.getFieldValue("MS")) || 0)})\n`;
          break;
        case "print_text":
          piece = `print(${pyString(current.getFieldValue("TEXT"))})\n`;
          break;
        case "gpio_write":
          piece = `Pin(${Number(current.getFieldValue("PIN"))}, Pin.OUT).value(${current.getFieldValue("VALUE")})\n`;
          break;
        case "scs009_setup":
          piece = t`pass  # SCS009はプログラム先頭で接続済みです\n`;
          break;
        case "uart_controller_setup":
        case "wifi_jog_setup":
          piece = t`pass  # JOGコントローラはプログラム先頭で接続済みです\n`;
          break;
        case "uart_scs_bind":
          piece = t`pass  # ${current.getFieldValue("AXIS")}軸をSCS009 ID ${Number(current.getFieldValue("ID"))}へ割り当て済みです\n`;
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
          piece = `for _ in range(${times}):\n${events?"    _adv_poll()\n":""}${body ? indent(body) : "    pass\n"}`;
          break;
        }
        case "forever_loop": {
          const body = chainToPython(current.getInputTargetBlock("DO"), level + 1);
          piece = `while True:\n${events ? "    _adv_poll()\n    time.sleep_ms(1)\n" : getUartControllerBlock() ? "    _controller_poll()\n    time.sleep_ms(5)\n" : ""}${body ? indent(body) : "    pass\n"}`;
          break;
        }
        default:
          piece = GeekDisplay.statement(current, BasicBlocks.expression, workspace.getAllBlocks(false)) || BasicBlocks.statement(current, chainToPython, indent, Boolean(getUartControllerBlock()), events) || ServoBlocks.statement(current) || t`pass  # 未対応のブロック: ${current.type}\n`;
      }
      code += piece;
      if(events && piece)code += "_adv_poll()\n";
      current = current.getNextBlock();
    }
    return code;
  }

  function generatePython() {
    const roots = workspace.getTopBlocks(true);
    const allBlocks = workspace.getAllBlocks(false);
    const profile = BOARD_PROFILES[selectedBoard];
    const uartSetup = getUartControllerBlock();
    const wifiSetup = profile.wifi && allBlocks.find((block) => block.type === "wifi_jog_setup");
    const usesSCS009 = allBlocks.some((block) => block.type.startsWith("scs009_"));
    const usesLed = allBlocks.some((block) => block.type === "pico_led");
    const setup = allBlocks.find((block) => block.type === "scs009_setup");
    const scsConfig = {
      pin: setup ? Number(setup.getFieldValue("PIN")) : 2,
      baud: setup ? Number(setup.getFieldValue("BAUD")) : 1000000,
    };
    const start = roots.find((block) => block.type === "program_start");
    const first = start ? start : roots.find((block) => block.previousConnection || block.nextConnection);
    let body = first ? chainToPython(first) : t("print(\"ブロックを置いてください\")\n");
    const scsCode = usesSCS009
      ? `\n${profile.platform === "esp32" ? ServoBlocks.espScsDriver(SCS009_DRIVER) : SCS009_DRIVER}\nscs009 = ${profile.platform === "esp32" ? "SCS009UART" : "SCS009PIO"}(data_pin=${scsConfig.pin}, baud=${scsConfig.baud})\n`
      : "";
    const ledCode = usesLed && profile.ledPin !== null ? (profile.platform === "esp32" ? ServoBlocks.ESP32_LED_DRIVER : `\nled = Pin(${profile.ledPin}, Pin.OUT, value=${profile.ledActiveLow ? 1 : 0})\n`) : "";
    let uartCode = "";
    if (uartSetup) {
      uartCode = PicoJog.runtime(getJogAxes(), wifiSetup ? {
        ssid: wifiSetup.getFieldValue("SSID"), password: wifiSetup.getFieldValue("PASSWORD"),
      } : null);
      body = body.replace(/time\.sleep_ms\((\d+)\)/g, "_controller_wait($1)");
      body = 'print("PICOBLOCKS_READY")\n' + body;
      if(!BasicBlocks.hasEvents(allBlocks))body += t`\n# PCからのJOG指令を待ちます\nwhile True:\n    _controller_poll()\n    time.sleep_ms(5)\n`;
    }
    const serialImports = uartSetup ? "\nimport sys\nimport select\nimport json" : "";
    const advancedCode = BasicBlocks.advancedDefinitions(allBlocks,chainToPython,indent);
    body = BasicBlocks.wrapAdvanced(body,allBlocks,indent);
    return t`# PicoBlocks Studio が生成しました\n# Board: ${profile.name}\nfrom machine import Pin\nimport time${serialImports}\n${scsCode}${ServoBlocks.runtime(allBlocks, profile)}${BasicBlocks.runtime(allBlocks, profile, Boolean(uartSetup))}${GeekDisplay.runtime(allBlocks)}${ledCode}${uartCode}${advancedCode}\n${body}`;
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
      return t`<g class="pin-hit"><title>物理ピン ${physical}: ${name}</title><circle cx="${x}" cy="${y}" r="3.2" class="board-pin ${active ? "active" : ""}"/><text x="${labelX}" y="${y + 2.2}" text-anchor="${anchor}" class="pin-label ${active ? "active" : ""}">${name}</text><text x="${numberX}" y="${y + 2.2}" text-anchor="${numberAnchor}" class="pin-number">${physical}</text></g>`;
    }).join("");
    const board = `
      <rect x="50" y="22" width="160" height="238" rx="16" class="board-body"/>
      <rect x="104" y="14" width="52" height="22" rx="5" class="usb"/>
      <circle cx="130" cy="62" r="8" class="button-mark"/>
      <text x="130" y="65" text-anchor="middle" class="tiny-label">BOOT</text>
      <rect x="100" y="94" width="60" height="70" rx="7" class="chip"/>
      <text x="130" y="124" text-anchor="middle" class="board-title">${profile.name.replace("Raspberry Pi ", "").toUpperCase()}</text>
      <text x="130" y="139" text-anchor="middle" class="board-subtitle">RP GPIO / PIO</text>
      ${makeSide(PICO_LEFT_PINS, 50, "left")}${makeSide(PICO_RIGHT_PINS, 210, "right")}`;
    return { board, dataPoint, groundPoint, logicPowerPoint:{x:210,y:84} };
  }

  function xiaoBoardDrawing(profile, selectedPin) {
    let dataPoint = null;
    const left = profile.pins.slice(0, 7).map((pin, i) => ({ pin, name: `D${i} / GP${pin}` }));
    const right = [{ name: "5V" }, { name: "GND" }, { name: "3V3" }, ...[10, 9, 8, 7].map(i => ({ pin: profile.pins[i], name: `D${i} / GP${profile.pins[i]}` }))];
    const side = (list, x, isLeft) => list.map((item, i) => {
      const y = 70 + i * 23, active = item.pin === selectedPin;
      if (active) dataPoint = { x, y };
      return t`<g class="pin-hit"><title>USBを上にした表面・${isLeft ? t("左") : t("右")}側の上から${i + 1}番: ${item.name}</title><circle cx="${x}" cy="${y}" r="4" class="board-pin ${active ? "active" : ""}"/><text x="${x + (isLeft ? 9 : -9)}" y="${y + 3}" text-anchor="${isLeft ? "start" : "end"}" class="pin-label ${active ? "active" : ""}">${item.name}</text></g>`;
    }).join("");
    const board = t`
      <rect x="38" y="42" width="184" height="196" rx="10" class="board-body"/>
      <rect x="105" y="31" width="50" height="28" rx="6" class="usb"/>
      <text x="130" y="120" text-anchor="middle" class="board-title">XIAO</text>
      <text x="130" y="135" text-anchor="middle" class="board-subtitle">${profile.name.includes("2350") ? "RP2350" : "RP2040"}</text>
      ${side(left, 38, true)}${side(right, 222, false)}
      <text x="130" y="260" text-anchor="middle" class="caption">表面 / USB-Cを上 · 両側の14端子</text>`;
    return { dataPoint, groundPoint: { x: 222, y: 93 }, logicPowerPoint:{x:222,y:116}, board };
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
        return t`<g class="pin-hit"><title>${group.name} / ${index + 1}番: ${name}</title><circle cx="${x}" cy="${y}" r="4.5" class="board-pin ${active ? "active" : name === "GND" ? "ground" : name === "3V3" ? "power" : ""}"/><text x="${x}" y="236" text-anchor="middle" class="pin-label ${active ? "active" : ""}">${name}</text><text x="${x}" y="247" text-anchor="middle" class="pin-number">${index + 1}</text></g>`;
      }).join("");
      return `<rect x="${group.x}" y="196" width="${width}" height="58" rx="7" class="connector-group"/><text x="${group.x + width / 2}" y="208" text-anchor="middle" class="connector-title">${group.name}</text>${pins}`;
    }).join("");
    const selectedGroup = selectedPin === 2 || selectedPin === 3 ? 0 : selectedPin === 4 || selectedPin === 5 ? 1 : 2;
    const dataPoint = selectedPin === null ? null : points[selectedPin];
    const groundPoint = grounds[selectedGroup];
    const board = t`
      <rect x="27" y="24" width="206" height="242" rx="18" class="board-body"/>
      <path d="M79 24h102v20H79z" class="usb"/>
      <rect x="63" y="61" width="134" height="76" rx="8" class="lcd"/>
      <text x="130" y="91" text-anchor="middle" class="board-title">${profile.name.replace("Waveshare ", "")}</text>
      <text x="130" y="108" text-anchor="middle" class="board-subtitle">内蔵LCD · 240 × 135</text>
      <rect x="88" y="149" width="84" height="32" rx="7" class="chip"/>
      <text x="130" y="168" text-anchor="middle" class="board-subtitle">EXTERNAL CONNECTORS</text>
      ${connectors}`;
    return { board, dataPoint, groundPoint, logicPowerPoint:{x:173,y:218} };
  }

  function atomBoardDrawing(profile, selectedPin) {
    // Connector groups, deliberately schematic rather than an unverified view
    // of the underside. Confirm physical orientation against M5Stack's pin map.
    let dataPoint = null;
    const groups = [
      {name: "EXPANSION", x: 50, pins: ["G19", "G21", "G22", "G23", "G25", "G33", "3V3", "5V", "GND"]},
      {name: "GROVE / HY2.0", x: 210, pins: ["GND", "5V", "G26", "G32"]},
    ];
    const connectors = groups.map(group => group.pins.map((name, index) => {
      const x = group.x, y = 66 + index * 20;
      const active = /^G\d+$/.test(name) && Number(name.slice(1)) === selectedPin;
      if (active) dataPoint = {x, y};
      return `<g class="pin-hit"><title>${group.name}: ${name}</title><circle cx="${x}" cy="${y}" r="4" class="board-pin ${active ? "active" : name === "GND" ? "ground" : name.endsWith("V") || name === "3V3" ? "power" : ""}"/><text x="${x === 50 ? 59 : 201}" y="${y + 3}" text-anchor="${x === 50 ? "start" : "end"}" class="pin-label">${name}</text></g>`;
    }).join("")).join("");
    const board = `<rect x="50" y="22" width="160" height="238" rx="16" class="board-body"/><rect x="105" y="14" width="50" height="22" rx="5" class="usb"/><text x="130" y="49" text-anchor="middle" class="board-title">ATOM Lite</text><text x="70" y="58" class="connector-title">EXPANSION</text><text x="170" y="58" class="connector-title">GROVE</text><circle cx="130" cy="126" r="21" class="button-mark"/><text x="130" y="128" text-anchor="middle" class="tiny-label">BUTTON G39</text><text x="130" y="162" text-anchor="middle" class="board-subtitle">RGB G27</text><text x="130" y="245" text-anchor="middle" class="caption">DEVELOPMENT / UNTESTED</text>${connectors}`;
    return {board, dataPoint, groundPoint: {x: 50, y: 226}, logicPowerPoint: {x: 50, y: 186}};
  }

  function renderWiringDiagram() {
    const profile = BOARD_PROFILES[selectedBoard];
    const blocks = workspace.getAllBlocks(false);
    if(profile.shield) {
      const diagram=BasicBlocks.shield.render(profile,blocks);
      elements.wiringDiagram.classList.remove('is-board-only');
      elements.wiringDiagram.innerHTML=`<svg viewBox="0 0 ${diagram.width} ${diagram.height}" xmlns="http://www.w3.org/2000/svg">${diagram.content}</svg>`;
      elements.wiringSummary.textContent=t('Motor Shield v0.7：StepStickを2台装着。J7は12 V、J8は安定化5 V。コントローラはUSB給電。実機未検証。');
      for(const id of ['wiringDevice','atomPullupGuide','signalLevelNote']) $('#'+id).hidden=true;
      $('#signalLegend').replaceChildren();
      elements.scsWiringDetails.hidden=true; elements.scsHelp.hidden=true; elements.boardPinHint.hidden=true;
      elements.pinoutLink.href=profile.pinoutUrl;
      elements.pinoutLink.textContent=t('シールドの設計資料・ピン配置');
      return;
    }
    const groups = ServoWiring.groups(blocks, getUartControllerBlock() ? getJogAxes() : {});
    const deviceSelect = $("#wiringDevice");
    const group = groups.find(g => g.key === deviceSelect.value);
    const visibleGroups = group ? [group] : groups;
    const primary = visibleGroups[0];
    $("#atomPullupGuide").hidden = !(profile.platform === "esp32" && visibleGroups.some(g => g.model !== "pwm"));
    const serialGroups = visibleGroups.filter(g => g.model !== "pwm");
    $("#signalLevelNote").hidden = !serialGroups.length;
    $("#signalLevelNote").textContent = serialGroups.map(g => ServoWiring.signalNote(g.model)).join(" ");
    const setup = primary ? {type: primary.model + "_setup"} : null;
    const servoName = primary?.name || "";
    const allOption = document.createElement("option"); allOption.value = "all"; allOption.textContent = t("すべてのサーボ");
    deviceSelect.replaceChildren(allOption, ...groups.map(g => {
      const option = document.createElement("option"); option.value = g.key;
      option.textContent = `${g.name} · ${g.model === "pwm" ? g.devices.length + t("台") : pinLabel(g.pin)}`;
      return option;
    }));
    deviceSelect.value = group?.key || "all";
    deviceSelect.hidden = groups.length < 2;
    const drawPin = pin => ({layout: profile.layout, ...(profile.layout === "atom" ? atomBoardDrawing(profile, pin) : profile.layout === "pico" ? picoBoardDrawing(profile, pin) : profile.layout === "xiao" ? xiaoBoardDrawing(profile, pin) : geekBoardDrawing(profile, pin))});
    const drawing = drawPin(null);
    elements.pinoutLink.href = profile.pinoutUrl;
    elements.pinoutLink.textContent = t`${profile.name}の公式ピン情報`;
    elements.wiringDiagram.classList.toggle("is-board-only", !setup);
    elements.scsWiringDetails.hidden = !setup;
    elements.scsHelp.hidden = !setup;
    elements.scsHelp.querySelector("summary").textContent = visibleGroups.length > 1 ? t("複数種類のサーボを接続する前に") : t`${servoName}を接続する前に`;
    elements.scsHelp.querySelector("p").textContent = visibleGroups.length > 1
      ? t("PWMは番号ごと、シリアル系は種類ごとの信号線です。異なる種類には別GPIOを使い、V+は各機種の定格に合う外部電源へ、GNDはボードと共通にします。種類の異なるV+同士は図でも接続していません。GPIOへの5 V入力は禁止です。図の線色は識別用で、実物の線色・端子順ではありません。")
      : setup?.type === "pwm_setup"
      ? t("信号線を選択したGPIOへつなぎ、電源はサーボ仕様に合う外部電源、GNDはボードと共通にします。50 Hzで出力します。初期値は1000〜2000 µsです。可動範囲は機種に合わせて調整してください。")
      : t`${servoName}の電源は専用の外部電源から供給し、GNDをボードと共通にします。PIOで送受信の方向を切り替えますが、電圧は変換しません。DATAの電圧を確認してから配線してください。${setup?.type === "xl330_setup" ? t("XL330は3.7〜6.0 V（初回5 V）。DATAに220 Ωの直列保護抵抗を推奨します。") : t("電源電圧は機種・仕様を確認してください。")} GPIOへの5 V入力は禁止です。まず無負荷でPing・位置読取りを確認してください。`;
    if (profile.experimental && serialGroups.length) elements.scsHelp.querySelector("p").textContent = t("ATOM Lite：開発中・動作未確認。単線UARTで方向を切り替えますが、電圧は変換しません。プルアップの前にDATAの電圧を確認してください。サーボは外部給電、GND共通。線色は識別用です。");
    elements.boardPinHint.hidden = !setup;
    $("#signalLegend").replaceChildren(...visibleGroups.flatMap(g => (g.model === "pwm" ? g.devices : [g.devices[0]]).map(d => {
      const item = document.createElement("span"), swatch = document.createElement("i");
      swatch.style.background = d.colour;
      item.append(swatch, `${g.model === "pwm" ? "PWM " + d.id : g.name} · ${pinLabel(g.model === "pwm" ? d.pin : g.pin)}`);
      return item;
    })));
    const diagramStyle = `
      .board-body{fill:#edf4f7;stroke:#78909c;stroke-width:2}.usb{fill:#c7ced6;stroke:#87929e}.chip{fill:#334155;stroke:#172033}.lcd{fill:#e7f6f4;stroke:#0f766e;stroke-width:1.5}.button-mark{fill:#fff;stroke:#8796a8}.board-pin{fill:#fff;stroke:#64748b;stroke-width:1}.board-pin.active{fill:#fbbf24;stroke:#b45309;stroke-width:2}.board-pin.ground{fill:#cbd5e1}.board-pin.power{fill:#fda4af}.pin-label{fill:#475467;font:6.5px Inter,sans-serif}.pin-label.active{fill:#9a3412;font-weight:800}.pin-number{fill:#667085;font:6.2px Inter,sans-serif}.board-title{fill:#172033;font:700 10px Inter,sans-serif}.board-subtitle,.tiny-label{fill:#667085;font:6.5px Inter,sans-serif}.connector-group{fill:#fff;stroke:#cbd5e1}.connector-title{fill:#344054;font:700 6px Inter,sans-serif}.device-box{fill:#fff;stroke:#b8c2cf;stroke-width:1.5}.terminal{fill:#f8fafc;stroke:#667085}.terminal-label{fill:#344054;font:700 8px Inter,sans-serif}.caption{fill:#667085;font:7px Inter,sans-serif}.data-wire{fill:none;stroke:#d69e00;stroke-width:3}.power-wire{fill:none;stroke:#e5484d;stroke-width:3}.ground-wire{fill:none;stroke:#64748b;stroke-width:3}.pin-hit{cursor:help}`;
    if (blocks.some(b=>['gcode_stepper','gcode_pen'].includes(b.type))) {
      deviceSelect.hidden=true;
      elements.wiringDiagram.classList.remove('is-board-only');
      elements.wiringSummary.textContent=t('外付けSTEP/DIRドライバが各軸に必要です。モータ直結は禁止。VM・ペンは外部給電、GND共通。TMCの電流・マイクロステップ設定は別途行います。');
      const diagram=ServoWiring.renderPlotterflow(blocks,drawPin,pinLabel);
      elements.wiringDiagram.innerHTML=`<svg viewBox="0 0 ${diagram.width} ${diagram.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><style>${diagramStyle}</style><title>PlotterFlow STEP/DIR + PWM</title>${diagram.content}</svg>`;
      return;
    }
    if (!setup) {
      elements.wiringSummary.textContent = t`${profile.name}の端子配置です。各端子へカーソルを合わせると番号を確認できます。`;
      elements.wiringDiagram.innerHTML = t`
        <svg viewBox="0 0 260 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <style>${diagramStyle}</style>
          <title>${profile.name}の簡易ピン配置</title>
          ${drawing.board}
          <text x="130" y="286" text-anchor="middle" class="caption">端子へカーソルを合わせると端子番号を確認できます</text>
        </svg>`;
      return;
    }
    elements.wiringSummary.textContent = visibleGroups.length > 1
      ? t("全種類の配線を表示中。PWMは番号別、シリアル系は種類別の色です。V+は種類ごとに分け、GNDを共通にします。")
      : primary.model === "pwm"
        ? t`PWM ${primary.devices.length}台：番号ごとにコネクタと信号線を色分け。電源・GNDは共通です。`
        : t`${pinLabel(primary.pin)} → ${servoName}。同じ種類のIDは同色のDATA線でデイジーチェーン接続します。`;
    const diagram = ServoWiring.render(visibleGroups, drawPin, pinLabel);
    elements.wiringDiagram.innerHTML = t`<svg viewBox="0 0 ${diagram.width} ${diagram.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><style>${diagramStyle}</style><title>${profile.name}のサーボ配線図</title>${diagram.content}</svg>`;
  }

  function updateBoardUi() {
    $("#resetHint").textContent = BOARD_PROFILES[selectedBoard].layout === "pico"
      ? t("純正Pico系にRSTボタンはありません。電源の入れ直し、またはRUN–GNDへ追加したリセットボタンを使います。")
      : t("この基板ではRST／RESETボタン、または電源の入れ直しを使います。BOOT判定には対応するMicroPythonが必要です。");
    const profile = BOARD_PROFILES[selectedBoard];
    $("#boardDevelopment").hidden = !profile.experimental;
    $("#atomHelp").hidden = !profile.experimental;
    $("#buttonWriteHint").textContent = profile.experimental
      ? t("ATOM Liteは電源を入れ直してから3秒以内に正面ボタンを押します（GPIO39）。初期ファーム書き込み用ではありません。")
      : t("再起動してから3秒以内にBOOTを押します。押したまま再起動すると初期ファーム用のモードになるので注意。");
    if (profile.experimental) $("#resetHint").textContent = t("電源の入れ直しで再起動します。USB接続中は「書き込み待機」ボタンも使えます。");
    elements.boardSelect.value = selectedBoard;
    PicoWifi.configure(profile.baseBoard || selectedBoard, !!profile.wifi);
    $('#shieldBoardNote').hidden=!profile.shield;
    $('#shieldCameraNote').hidden=profile.shield!=='touch2';
    $("#wifiHelp").hidden = !profile.wifi;
    $("#lcdHelp").hidden = !GeekDisplay.supported(selectedBoard);
    elements.boardPinHint.textContent = t`接続で選べる端子: ${profile.pins.map(pinLabel).join(" · ")}${profile.layout === "xiao" ? t("。今回は両側のD0〜D10端子に対応（背面パッドは対象外）。") : ""}`;
    elements.firmwareLink.href = profile.firmwareUrl;
    elements.firmwareLink.textContent = t`${profile.name}用ファームを入手 ↗`;
    elements.firmwareSteps.replaceChildren();
    const steps = profile.platform === "esp32" ? [
      t("下のリンクから標準ESP32_GENERICの安定版.bin（1.29以降）を入手。S3/C3版・UIFlow・UF2は使いません。"),
      t("既存のUIFlow・プログラムをバックアップしてから、公式手順でesptoolのerase-flash、続けてwrite-flash 0x1000を実行します。消去すると設定・ファイルは失われます。"),
      profile.boot,
      t("再起動後、このサイトのUSB接続でFTDIのシリアルポートを選択。表示されなければM5Stack公式案内のFTDIドライバを確認してください。"),
    ] : [
      profile.firmwareIsZip
        ? t("下のリンクからZIPを入手し、展開してUF2を用意。")
        : t`下のリンクから安定版UF2を入手${profile.wifi ? t("（1.29以降）") : ""}${selectedBoard.includes("2350") || selectedBoard.startsWith("pico2") ? t("。Arm版を選択") : ""}。`,
      profile.boot,
      t`表示された「${profile.driveName}」ドライブへUF2をコピー。自動で再起動します。`,
    ];
    for (const text of steps) {
      const item = document.createElement("li");
      item.textContent = text;
      elements.firmwareSteps.appendChild(item);
    }
    renderWiringDiagram();
  }

  function validateSCS009Pins() {
    for (const block of workspace.getAllBlocks(false).filter((item) => /^(scs009|xl330|sts3215|sts3235|pwm)_setup$/.test(item.type) || /^basic_(adc|read|write)$/.test(item.type))) {
      const allowed = (block.type === "basic_adc" ? adcOptions() : pinOptions()).map(([, pin]) => pin);
      const oldPin = block.getFieldValue("PIN");
      // Blockly 11 has dynamic getOptions, but not the newer setOptions API.
      const field = block.getField("PIN");
      field.getOptions(false);
      Blockly.Events.disable();
      try {
        field.setValue(allowed.find(pin => pin !== oldPin) || allowed[0]);
        field.setValue(allowed.includes(oldPin) ? oldPin : allowed[0]);
      } finally { Blockly.Events.enable(); }
    }
  }

  function selectBoard(boardId) {
    if (!BOARD_PROFILES[boardId]) return;
    selectedBoard = boardId;
    localStorage.setItem("picoblocks-board-v1", selectedBoard);
    workspace.updateToolbox(buildToolbox());
    workspace.getToolbox()?.clearSelection();
    workspace.getFlyout()?.hide();
    validateSCS009Pins();
    updateBoardUi();
    elements.pythonCode.textContent = generatePython();
    updateControllerUi();
  }

  function setWiringCollapsed(collapsed) {
    elements.appShell.classList.toggle("wiring-collapsed", collapsed);
    elements.wiringToggle.setAttribute("aria-expanded", String(!collapsed));
    elements.wiringToggle.title = collapsed ? t("配線ガイドを開く") : t("配線ガイドを閉じる");
    localStorage.setItem("picoblocks-wiring-collapsed-v1", collapsed ? "1" : "0");
    requestAnimationFrame(() => Blockly.svgResize(workspace));
  }
  $("#wiringDevice").addEventListener("change", renderWiringDiagram);

  let saveTimer = null;
  workspace.addChangeListener((event) => {
    if (event.isUiEvent) return;
    updateControllerUi();
    const code = generatePython();
    elements.pythonCode.textContent = code;
    renderWiringDiagram();
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
    return workspace.getAllBlocks(false).find((block) => block.type === "uart_controller_setup" ||
      (BOARD_PROFILES[selectedBoard].wifi && block.type === "wifi_jog_setup")) || null;
  }

  function getJogAxes() {
    const blocks = workspace.getAllBlocks(false);
    const hasScs = blocks.some(block => block.type === "scs009_setup");
    // Explicit bindings define the connected servos. Do not invent an ID 4
    // for a three-servo example; keep implicit four-axis mapping for old data.
    const hasBindings = blocks.some(block => /^(uart_scs|xl330|sts3215|sts3235|pwm)_bind$/.test(block.type));
    const config = PicoJog.defaults(hasScs && !hasBindings);
    for (const block of blocks.filter(block => /^(uart_scs|xl330|sts3215|sts3235|pwm)_bind$/.test(block.type))) {
      const target = block.type === "uart_scs_bind" ? "scs009" : block.type.split("_")[0];
      const connected = blocks.some(b => b.type === target + "_setup" && (target !== "pwm" || b.getFieldValue("CHANNEL") === block.getFieldValue("ID")));
      config[block.getFieldValue("AXIS")] = {
        id: connected ? Number(block.getFieldValue("ID")) : null, target,
        center: Number(block.getFieldValue("CENTER")), step: Number(block.getFieldValue("STEP")), speed: Number(block.getFieldValue("SPEED") || 0),
        min: 0, max: ServoBlocks.models[target]?.max || 1023,
      };
    }
    return config;
  }

  function validateProgram({throwOnError = false} = {}) {
    const blocks = workspace.getAllBlocks(false);
    const wifi = blocks.filter(block => block.type === "wifi_jog_setup");
    let error = "";
    if (GeekDisplay.uses(blocks) && !GeekDisplay.supported(selectedBoard)) error = t("LCD文字表示はRP2040-GEEK / RP2350-GEEK専用です。ボードを選び直すかLCDブロックを外してください。");
    const bindings = blocks.filter(block => /^(uart_scs|xl330|sts3215|sts3235|pwm)_bind$/.test(block.type));
    if (new Set(bindings.map(b => b.getFieldValue("AXIS"))).size !== bindings.length) error = t("JOGの同じ軸への割り当ては1個だけにしてください。USBとWi-Fiで共用します。");
    if (wifi.length && !BOARD_PROFILES[selectedBoard].wifi) error = t("Wi-Fi JOGはPico W / Pico 2 W / ATOM Lite（開発中）で使えます。ボードを選び直すかWi-Fiブロックを外してください。");
    if (wifi.length > 1) error = t("Wi-Fiサーバの開始ブロックは1個にしてください。");
    if (wifi.length) {
      const ssid = wifi[0].getFieldValue("SSID"), password = wifi[0].getFieldValue("PASSWORD");
      if (!ssid || encoder.encode(ssid).length > 32 || !/^[\x20-\x7e]{8,63}$/.test(password)) error = t("Wi-Fi名は1〜32バイト、パスワードは半角8〜63文字で指定してください。");
    }
    const setups = blocks.filter(b => /^(scs009|xl330|sts3215|sts3235|pwm)_setup$/.test(b.type));
    if (setups.filter(b => b.type !== "pwm_setup").length > 2) error = t("シリアルサーボ接続は合計2種類までです（RPはPIO、ATOM LiteはUSB以外のUARTを使用）。PWMサーボは別に追加できます。");
    if (new Set(setups.map(b => b.getFieldValue("PIN"))).size !== setups.length) error = t("サーボ接続のGPIOが重複しています。種類ごとに別のGPIOを指定してください。");
    for (const key of ["scs009", "xl330", "sts3215", "sts3235"]) {
      if (setups.filter(b => b.type === key + "_setup").length > 1) error = t`${key}の接続ブロックは1個にしてください。同じ種類のサーボはIDで指定します。`;
      if (blocks.some(b => b.type.startsWith(key + "_") && b.type !== key + "_setup") && !setups.some(b => b.type === key + "_setup")) error = t`${key}の接続ブロックを追加してください。`;
    }
    const pwmSetups = setups.filter(b => b.type === "pwm_setup");
    const hardware = blocks.filter(b => /^(basic_(adc|read|write)|gpio_write)$/.test(b.type));
    for (const b of [...setups, ...hardware]) {
      const allowed = b.type === "basic_adc" ? (BOARD_PROFILES[selectedBoard].adcPins ?? BOARD_PROFILES[selectedBoard].pins.filter(p=>p>=26&&p<=29)) : BOARD_PROFILES[selectedBoard].pins;
      if (!allowed.includes(Number(b.getFieldValue("PIN")))) error = t("このボードでは使えないGPIOが指定されています。ピンを選び直してください。");
    }
    for (const b of hardware) {
      const pin = String(b.getFieldValue("PIN"));
      if (setups.some(s => String(s.getFieldValue("PIN")) === pin)) error = t("サーボ接続とADC・GPIOには別々のピンを指定してください。");
      const mode = item => item.type === "gpio_write" ? "basic_write" : item.type;
      if (hardware.some(other => String(other.getFieldValue("PIN")) === pin && (mode(other) !== mode(b) || (b.type === "basic_read" && other.getFieldValue("PULL") !== b.getFieldValue("PULL"))))) error = t("同じGPIOの入力・出力・ADC・プル設定が競合しています。");
    }
    if (blocks.some(b => b.type === "gpio_write" && setups.some(s => s.getFieldValue("PIN") === b.getFieldValue("PIN")))) error = t("サーボの接続GPIOには、通常のGPIO出力ブロックを同時に使えません。");
    const channels = pwmSetups.map(b => b.getFieldValue("CHANNEL"));
    if (new Set(channels).size !== channels.length) error = t("PWMサーボの番号が重複しています。");
    // RP PWM outputs GPn and GP(n+16) share one channel; their duties cannot differ.
    const pwmChannels = pwmSetups.map(b => Number(b.getFieldValue("PIN")) % 16);
    if (BOARD_PROFILES[selectedBoard].platform !== "esp32" && new Set(pwmChannels).size !== pwmChannels.length) error = t("この2本のGPIOはPWM出力を共有します。16番違いではないGPIOを選んでください。");
    for (const b of blocks.filter(b => b.type.startsWith("pwm_"))) {
      if (b.type === "pwm_setup" && Number(b.getFieldValue("MIN_US")) >= Number(b.getFieldValue("MAX_US"))) error = t("PWMの0°パルス幅は180°より小さくしてください。");
      if (b.type !== "pwm_setup" && !channels.includes(b.getFieldValue(b.type === "pwm_bind" ? "ID" : "CHANNEL"))) error = t("この番号のPWMサーボ接続ブロックを追加してください。");
    }
    error = BasicBlocks.validate(blocks,BOARD_PROFILES[selectedBoard]) || error;
    if (error && throwOnError) throw new Error(error);
    if (error) showToast(error, "error");
    return !error;
  }

  function getUartControllerConfig() {
    // Viewing the controller is separate from whether this board can run it.
    const blocks = workspace.getAllBlocks(false);
    const wifi = blocks.some(block => block.type === "wifi_jog_setup");
    if (!wifi && !blocks.some(block => block.type === "uart_controller_setup")) return null;
    return { transport: "usb-serial", unsupportedWifi: wifi && !BOARD_PROFILES[selectedBoard].wifi };
  }

  function updateControllerUi() {
    const config = getUartControllerConfig();
    const hasController = Boolean(config);
    elements.controllerMenuItem.disabled = !hasController;
    elements.run.lastChild.textContent = hasController ? (controllerActive ? t(" 操作中") : t(" コントローラを開始")) : t(" 今すぐ実行");
    elements.run.disabled = !port || isBusy || controllerActive;
    const menuHelp = elements.controllerMenuItem.querySelector("small");
    menuHelp.textContent = config?.unsupportedWifi ? t("Wi-Fi対応ボードを選んでください") : hasController ? t("矢印・WASDで4軸を操作") : t("UART / Wi-Fi JOGブロックで有効");
    $("#controllerSetupHint").hidden = !config?.unsupportedWifi;
    const canOperate = hasController && !config.unsupportedWifi;
    const enabled = canOperate && controllerActive && !isBusy;
    elements.controllerConnect.disabled = isBusy || (!controllerActive && !canOperate);
    for (const button of document.querySelectorAll("[data-jog-axis]")) button.disabled = !enabled;
    elements.jogCenter.disabled = !enabled;

    if (!hasController && elements.controllerDrawer.getAttribute("aria-hidden") === "false") closeController();
    if (!config) return;

    const nextAxes = getJogAxes();
    const signature = JSON.stringify(nextAxes);
    if (signature !== controllerConfigSignature) {
      for (const axis of PicoJog.axes) {
        controllerAxes[axis] = nextAxes[axis];
        controllerValues[axis] = nextAxes[axis].center;
      }
      controllerConfigSignature = signature;
    }
    elements.controllerPortSummary.textContent = port
      ? t("ボードへのWeb Serial接続を共用します")
      : t("上部の「ボードを接続」と同じ接続を使います");
    for (const axis of PicoJog.axes) {
      $(`#jogValue${axis}`).textContent = controllerValues[axis];
      $(`#jogBinding${axis}`).textContent = PicoJog.label(nextAxes[axis]);
    }
  }

  function setMenuOpen(open) {
    if (open) updateControllerUi();
    elements.appMenu.hidden = !open;
    elements.menuButton.setAttribute("aria-expanded", String(open));
  }

  function openController() {
    if (!getUartControllerConfig()) return;
    setMenuOpen(false);
    updateControllerUi();
    elements.controllerDrawer.setAttribute("aria-hidden", "false");
  }

  function closeController() {
    elements.controllerDrawer.setAttribute("aria-hidden", "true");
  }

  function updateControllerConnection() {
    elements.controllerConnectionLabel.textContent = controllerActive
      ? t("コントローラ操作中")
      : port ? t("ボード 接続済み") : t("ボード 未接続");
    elements.controllerConnect.textContent = controllerActive
      ? t("コントローラを停止")
      : port ? t("コントローラを開始") : t("ボードを接続");
    elements.controllerConnect.classList.toggle("is-connected", controllerActive);
    updateControllerUi();
  }

  async function connectController() {
    if (isBusy) return;
    if (controllerActive) {
      await stopProgram();
      controllerActive = false;
      updateControllerConnection();
      return;
    }
    if (!getUartControllerConfig() || !validateProgram()) return;
    if (!port) {
      await connect();
      return;
    }
    try {
      setBusy(true, t("準備中…"));
      showTab("console");
      await enterRawRepl();
      serialBuffer = "";
      await writeSource('print("")\n' + generatePython());
      await writeControl(0x04);
      await waitFor("OK", 3000);
      await waitFor("PICOBLOCKS_READY", 15000);
      setBoardMode("RUN");
      controllerActive = true;
      showToast(t("同じUSB接続でコントローラを開始しました。"), "success");
    } catch (error) {
      controllerActive = false;
      showToast(t`コントローラを開始できませんでした: ${error.message}`, "error");
    } finally {
      setBusy(false);
      updateControllerConnection();
    }
  }

  function jogAxis(axis, direction) {
    sendJogCommand(`DELTA ${axis} ${direction}\n`);
  }

  async function centerJog() {
    await sendJogCommand("CENTER\n");
  }

  let jogSending = false;
  async function sendJogCommand(command) {
    if (!controllerActive || !port || isBusy || jogSending) return;
    const config = getUartControllerConfig();
    if (!config || config.unsupportedWifi) return;
    jogSending = true;
    try { await writeBytes(command); }
    catch (error) { controllerActive = false; updateControllerConnection(); showToast(error.message, "error"); }
    finally { jogSending = false; }
  }

  function setConnection(state, label) {
    const wireless = PicoWifi.selected();
    if (wireless && !isBusy) {
      state = PicoWifi.connected() ? "online" : "offline";
      label = PicoWifi.connected() ? t("Wi-Fi接続済み") : t("Wi-Fi未接続");
    }
    elements.connectionState.dataset.state = state;
    elements.connectionLabel.textContent = label;
    const connected = state === "online" || state === "busy";
    elements.run.disabled = wireless || !connected || isBusy;
    elements.save.disabled = !connected || isBusy;
    elements.writeMode.disabled = wireless || !connected || isBusy;
    elements.stop.disabled = wireless || !connected || isBusy;
    elements.connect.disabled = isBusy;
    elements.connect.lastChild.textContent = wireless ? t(" Wi-Fi接続") : port ? t(" 切断する") : t(" ボードを接続");
    elements.actionHint.textContent = wireless ? t("無線は書き込み待機中の「保存して実行」に対応。実行中の停止・シリアル表示はUSBを使います。") : connected
      ? t("接続済み。ブロックを作って実行できます。")
      : t("先に「ボードを接続」を押してください。");
  }

  function setBusy(busy, label = t("処理中…")) {
    $("#languageSelect").disabled = busy;
    elements.boardSelect.disabled = busy;
    isBusy = busy;
    PicoWifi.setBusy(busy);
    setConnection(busy ? "busy" : port ? "online" : "offline", busy ? label : port ? t("接続済み") : t("未接続"));
    updateControllerConnection();
  }

  let controllerOutput = "";
  function appendConsole(text) {
    controllerOutput = (controllerOutput + text).slice(-12000);
    let lineEnd;
    while ((lineEnd = controllerOutput.indexOf("\n")) !== -1) {
      const line = controllerOutput.slice(0, lineEnd).trim();
      controllerOutput = controllerOutput.slice(lineEnd + 1);
      if (line === "PICOBLOCKS_BOOT_WINDOW") setBoardMode("BOOT");
      if (line === "PICOBLOCKS_MODE WRITE") setBoardMode("WRITE");
      if (line === "PICOBLOCKS_MODE RUN") setBoardMode("RUN");
      if (line === "PICOBLOCKS_FINISHED") setBoardMode("FINISHED");
      if (line.includes("Traceback (most recent call last)")) setBoardMode("STOPPED");
      if (line.startsWith("PICOBLOCKS_STATE ")) {
        try {
          const values = JSON.parse(line.slice(17));
          for (const axis of PicoJog.axes) if (Number.isFinite(values[axis])) controllerValues[axis] = values[axis];
          updateControllerUi();
        } catch (_) { /* Ignore incomplete output. */ }
      }
      if (line.startsWith("PICOBLOCKS_WIFI ")) {
        const url = line.slice(16);
        if (/^http:\/\/(\d{1,3}\.){3}\d{1,3}\/$/.test(url)) {
          $("#wifiJogAddress").textContent = url;
          $("#wifiJogAddress").href = url;
        }
      }
      if (line.startsWith("PICOBLOCKS_ERROR ")) showToast(line.slice(17), "error");
      if (controllerActive && line.includes("Traceback (most recent call last)")) {
        controllerActive = false;
        updateControllerConnection();
      }
    }
    if (!consoleStarted) {
      elements.serialConsole.textContent = "";
      consoleStarted = true;
    }
    elements.serialConsole.textContent += text;
    elements.consolePanel.scrollTop = elements.consolePanel.scrollHeight;
  }

  function notifyWaiters() {
    for (const waiter of [...waiters]) {
      if (typeof waiter.pattern === "string" ? serialBuffer.includes(waiter.pattern) : waiter.pattern.test(serialBuffer)) {
        waiters.delete(waiter);
        clearTimeout(waiter.timer);
        waiter.resolve(serialBuffer);
      }
    }
  }

  function waitFor(pattern, timeout = 3500) {
    if (typeof pattern === "string" ? serialBuffer.includes(pattern) : pattern.test(serialBuffer)) return Promise.resolve(serialBuffer);
    return new Promise((resolve, reject) => {
      const waiter = { pattern, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        waiters.delete(waiter);
        reject(new Error(t`ボードからの応答を確認できませんでした: ${JSON.stringify(pattern)}`));
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
        if (port) appendConsole(t`\n[受信エラー] ${error.message}\n`);
      } finally {
        reader.releaseLock();
        reader = null;
      }
      if (port) await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async function writeBytes(bytes) {
    if (!port?.writable) throw new Error(t("ボードが接続されていません。"));
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

  async function writeSource(source) {
    const bytes = encoder.encode(source);
    for (let offset = 0; offset < bytes.length; offset += 256) {
      await writeBytes(bytes.slice(offset, offset + 256));
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async function enterRawRepl() {
    serialBuffer = "";
    await writeControl(0x03, 0x03);
    await new Promise((resolve) => setTimeout(resolve, 120));
    serialBuffer = "";
    await writeControl(0x01);
    await waitFor(">");
    // Release the previous program's PIO/PWM/network resources before reloading.
    // Raw-REPL soft reset skips main.py, like MicroPython's mpremote.
    serialBuffer = "";
    await writeControl(0x04);
    await waitFor("soft reboot", 8000);
    await waitFor("raw REPL; CTRL-B to exit\r\n>", 8000);
    setBoardMode("WRITE");
  }

  async function executeRaw(code, timeout = 9000) {
    await enterRawRepl();
    serialBuffer = "";
    await writeSource(code);
    await writeControl(0x04);
    await waitFor("OK", 3000);
    await waitFor("\u0004>", timeout);
    const result = serialBuffer;
    if (result.includes("Traceback (most recent call last)")) throw new Error(t("MicroPythonでエラーが発生しました。シリアル表示を確認してください。"));
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
    if (PicoWifi.selected()) { PicoWifi.open(); return; }
    if (!("serial" in navigator)) {
      showToast(t("このブラウザーはWeb Serialに対応していません。PC版ChromeまたはEdgeを使用してください。"), "error");
      return;
    }
    if (port) {
      await disconnect();
      return;
    }
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200, bufferSize: 65536 });
      setBoardMode("UNKNOWN");
      readLoopPromise = readLoop();
      setConnection("online", t("接続済み"));
      elements.connect.lastChild.textContent = t(" 切断する");
      showToast(t("ボードに接続しました。"), "success");
      appendConsole(t("\n[接続しました]\n"));
      updateControllerConnection();
    } catch (error) {
      port = null;
      setConnection("offline", t("未接続"));
      updateControllerConnection();
      if (error.name !== "NotFoundError") showToast(t`接続できませんでした: ${error.message}`, "error");
    }
  }

  async function disconnect() {
    const activePort = port;
    port = null;
    controllerActive = false;
    setBoardMode("UNKNOWN");
    try {
      if (reader) await reader.cancel();
      if (readLoopPromise) await readLoopPromise;
      if (activePort) await activePort.close();
    } catch (error) {
      console.warn("Disconnect warning", error);
    }
    readLoopPromise = null;
    elements.connect.lastChild.textContent = t(" ボードを接続");
    setConnection("offline", t("未接続"));
    appendConsole(t("\n[切断しました]\n"));
    updateControllerConnection();
  }

  async function runProgram() {
    if (!port || isBusy) return;
    if (!validateProgram()) return;
    if (getUartControllerBlock()) {
      if (controllerActive) {
        showToast(t("コントローラはすでに動作中です。"));
        return;
      }
      await connectController();
      return;
    }
    setBusy(true, t("実行中…"));
    showTab("console");
    try {
      await enterRawRepl();
      serialBuffer = "";
      await writeSource('print("\\nPICOBLOCKS_MODE RUN")\n' + generatePython() + '\nprint("PICOBLOCKS_FINISHED")\n');
      await writeControl(0x04);
      await waitFor("OK", 3000);
      // Do not wait for an infinite user program to exit. Stop remains available.
      showToast(t("一時実行を開始しました。保存内容は変更していません。"), "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveProgram() {
    if (PicoWifi.selected()) {
      if (!isBusy && validateProgram()) await PicoWifi.upload(generatePython());
      return;
    }
    if (!port || isBusy) return;
    if (!validateProgram()) return;
    controllerActive = false;
    updateControllerConnection();
    setBusy(true, t("保存中…"));
    showTab("console");
    try {
      const source = generatePython();
      const saveCommand = PicoBoot.saveCommand(source, bytesLiteral, selectedBoard);
      await executeRaw(saveCommand, 12000);
      if (!serialBuffer.includes("PICOBLOCKS_SAVED")) throw new Error(t("保存完了を確認できませんでした。"));
      serialBuffer = "";
      setBoardMode("BOOT");
      await writeControl(0x02, 0x04);
      await waitFor("PICOBLOCKS_MODE ", 10000);
      if (serialBuffer.includes("PICOBLOCKS_MODE WRITE")) {
        showToast(t("保存済みです。今回は書き込み待機に入りました。"));
      } else {
        if (getUartControllerBlock()) {
          await waitFor("PICOBLOCKS_READY", 15000);
          controllerActive = true;
        }
        showToast(t("保存して起動しました。外部給電があればUSBを抜いても動作します。"), "success");
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function stopProgram() {
    if (!port || isBusy) return;
    try {
      await writeControl(0x03, 0x03, 0x02);
      setBoardMode("STOPPED");
      appendConsole(t("\n[停止しました]\n"));
      showToast(t("プログラムを停止しました。"));
      controllerActive = false;
      updateControllerConnection();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function enterWriteMode() {
    if (!port || isBusy) return;
    controllerActive = false;
    setBusy(true, t("書き込み待機へ…"));
    showTab("console");
    try {
      await enterRawRepl();
      await writeControl(0x02);
      setBoardMode("WRITE");
      showToast(t("書き込み待機に入りました。保存プログラムは残っています。"));
    } catch (error) {
      setBoardMode("UNKNOWN");
      showToast(error.message, "error");
    } finally { setBusy(false); }
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
  elements.writeMode.addEventListener("click", enterWriteMode);
  elements.boardSelect.addEventListener("change", () => selectBoard(elements.boardSelect.value));
  elements.wiringToggle.addEventListener("click", () => setWiringCollapsed(!elements.appShell.classList.contains("wiring-collapsed")));
  elements.undo.addEventListener("click", () => workspace.undo(false));
  elements.redo.addEventListener("click", () => workspace.undo(true));
  elements.codeTab.addEventListener("click", () => showTab("code"));
  elements.consoleTab.addEventListener("click", () => showTab("console"));
  elements.copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(elements.pythonCode.textContent);
    showToast(t("Pythonコードをコピーしました。"), "success");
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
  const helpDialog = $("#helpDialog");
  const firstRunGuide = $("#firstRunGuide");
  const firstRunKey = "picoblocks-hide-first-run-v1";
  function hideFirstRun(remember = false) {
    if (remember) localStorage.setItem(firstRunKey, "1");
    firstRunGuide.hidden = true;
    $("#undoButton").focus();
  }
  $("#helpMenuItem").addEventListener("click", () => {
    setMenuOpen(false);
    helpDialog.showModal();
  });
  $("#helpClose").addEventListener("click", () => helpDialog.close());
  $("#dismissFirstRun").addEventListener("click", () => hideFirstRun());
  $("#hideFirstRun").addEventListener("change", event => {
    if (event.target.checked) hideFirstRun(true);
  });
  $("#showFirmwareSteps").addEventListener("click", () => {
    hideFirstRun();
    $("#firmwareHelp").open = true;
    $("#firmwareHelp summary").focus();
    $("#firmwareHelp").scrollIntoView({block:"nearest"});
  });
  $("#showFirstRun").addEventListener("click", () => {
    localStorage.setItem(firstRunKey, "0");
    $("#hideFirstRun").checked = false;
    helpDialog.close();
    firstRunGuide.hidden = false;
    $("#showFirmwareSteps").focus();
  });
  firstRunGuide.hidden = localStorage.getItem(firstRunKey) === "1";
  const exchangeDialog = $("#exchangeDialog");
  const backupKey = "picoblocks-import-backup-v1";
  const exchangeStatus = (message, error = false) => {
    $("#exchangeStatus").textContent = message;
    $("#exchangeStatus").dataset.error = String(error);
  };
  function boardCatalog(board) {
    const previous = selectedBoard;
    Blockly.Events.disable();
    try {
      selectedBoard = board;
      return BlockExchange.catalog(Blockly, buildToolbox());
    } finally { selectedBoard = previous; Blockly.Events.enable(); }
  }
  function refreshExchangePrompt() {
    const board = BOARD_PROFILES[selectedBoard];
    $("#exchangeBoard").textContent = t`選択中: ${board.name}`;
    $("#promptText").value = BlockExchange.prompt(selectedBoard, board, boardCatalog(selectedBoard));
  }
  $("#exchangeMenuItem").addEventListener("click", () => {
    setMenuOpen(false);
    refreshExchangePrompt();
    $("#restoreImport").disabled = !localStorage.getItem(backupKey);
    exchangeStatus("");
    exchangeDialog.showModal();
  });
  $("#exchangeClose").addEventListener("click", () => exchangeDialog.close());
  $("#copyPrompt").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#promptText").value);
      exchangeStatus(t("依頼文をコピーしました。対話ツールへ貼り付け、作りたい動きを書いてください。"));
    } catch {
      $("#promptText").closest("details").open = true;
      $("#promptText").focus(); $("#promptText").select();
      exchangeStatus(t("自動コピーが許可されませんでした。選択した依頼文を手動でコピーしてください。"), true);
    }
  });
  function replaceFromExchange(data, restoring = false, targetBackupKey = backupKey) {
    if (isBusy || controllerActive) throw new Error(t("実行・操作を停止してから取り込んでください。"));
    const previous = {board: selectedBoard, workspace: Blockly.serialization.workspaces.save(workspace)};
    const scratch = new Blockly.Workspace();
    let replaced = false;
    Blockly.Events.disable();
    try {
      selectedBoard = data.board;
      Blockly.serialization.workspaces.load(data.workspace, scratch);
      // Reject Blockly's silent disconnection/repair before touching the user's work.
      if (!restoring && (scratch.getTopBlocks(false).length !== 1 || scratch.getAllBlocks(false).length !== data.count)) throw new Error(t("ブロックの接続を読み込めません。JSONのinputsとnextを確認してください。"));
      replaced = true;
      Blockly.serialization.workspaces.load(data.workspace, workspace);
      normalizeWorkspace();
      if (!restoring) validateProgram({throwOnError: true});
      const code = generatePython();
      if (!restoring) localStorage.setItem(targetBackupKey, JSON.stringify(previous));
      localStorage.setItem("picoblocks-workspace-v1", JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
      localStorage.setItem("picoblocks-board-v1", selectedBoard);
      elements.pythonCode.textContent = code;
    } catch (error) {
      selectedBoard = previous.board;
      if (replaced) {
        Blockly.serialization.workspaces.load(previous.workspace, workspace);
        normalizeWorkspace();
      }
      throw error;
    } finally {
      scratch.dispose(); Blockly.Events.enable();
      workspace.updateToolbox(buildToolbox());
      updateBoardUi(); updateControllerUi();
      elements.pythonCode.textContent = generatePython();
      $("#restoreImport").disabled = !localStorage.getItem(backupKey);
      Blockly.svgResize(workspace);
    }
  }
  $("#importBlocks").addEventListener("click", () => {
    try {
      const data = BlockExchange.parse($("#importText").value, BOARD_PROFILES, boardCatalog);
      replaceFromExchange(data);
      refreshExchangePrompt();
      exchangeStatus(t`${BOARD_PROFILES[data.board].name}に${data.count}個のブロックを取り込みました。閉じて配線・位置範囲・生成コードを確認してから実行してください。`);
    } catch (error) { exchangeStatus(error.message, true); }
  });
  const sampleDialog = $("#sampleDialog");
  const sampleBackupKey = "picoblocks-sample-backup-v1";
  const sampleStatus = (message, error = false) => {
    $("#sampleStatus").textContent = message;
    $("#sampleStatus").dataset.error = String(error);
  };
  function refreshSamples() {
    const profile = BOARD_PROFILES[selectedBoard];
    const model = $("#sampleModel").value;
    $('#loadSample').disabled=!!profile.shield;
    $('#loadSample').hidden=!!profile.shield;
    $('#servoSampleSection').hidden=!!profile.shield;
    $('#shieldSampleNote').hidden=!profile.shield;
    if(profile.shield) $('#gcodeSampleBoard').value=selectedBoard;
    $("#sampleBoard").textContent = t`選択中: ${profile.name}`;
    $("#sampleTransport option[value=wifi]").disabled = !profile.wifi;
    if (!profile.wifi) $("#sampleTransport").value = "usb";
    const wifi = $("#sampleTransport").value === "wifi";
    $("#sampleWifiUnavailable").hidden = Boolean(profile.wifi);
    $("#sampleWifiSteps").hidden = !wifi;
    $("#sampleUsbSteps").hidden = wifi;
    $("#sampleLcdNote").hidden = !GeekDisplay.supported(selectedBoard);
    $("#sampleExperimental").hidden = !profile.experimental;
    $("#sampleSerialNote").hidden = model === "pwm";
    $("#samplePwmNote").hidden = model !== "pwm";
    const pins = PicoSamples.pins(profile).map(pin => profile.pinLabels?.[pin] || `GP${pin}`);
    $("#sampleWiring").textContent = model === "pwm"
      ? t`信号線: 1 → ${pins[0]} / 2 → ${pins[1]} / 3 → ${pins[2]}`
      : t`DATA: ${pins[0]} → ID 1 → ID 2 → ID 3（デイジーチェーン）`;
    $("#sampleBaud").textContent = model === "pwm" ? "50 Hz / 1000–2000 µs" : model === "xl330" ? "57,600 bps" : "1,000,000 bps";
    $("#restoreSample").disabled = !localStorage.getItem(sampleBackupKey);
  }
  $("#samplesMenuItem").addEventListener("click", () => {
    setMenuOpen(false);
    refreshSamples(); sampleStatus(""); sampleDialog.showModal();
  });
  $("#sampleClose").addEventListener("click", () => sampleDialog.close());
  for (const id of ["#sampleModel", "#sampleTransport"]) $(id).addEventListener("change", () => {refreshSamples(); sampleStatus("");});
  $("#loadSample").addEventListener("click", () => {
    try {
      const json = PicoSamples.create(selectedBoard, BOARD_PROFILES[selectedBoard], $("#sampleModel").value, $("#sampleTransport").value);
      replaceFromExchange(BlockExchange.parse(JSON.stringify(json), BOARD_PROFILES, boardCatalog), false, sampleBackupKey);
      refreshSamples();
      sampleStatus(t("サンプルを読み込みました。閉じて配線・ID・中央位置を確認してから実行してください。自動実行はしていません。"));
    } catch (error) {sampleStatus(error.message, true);}
  });
  $("#restoreSample").addEventListener("click", () => {
    try {
      const previous = JSON.parse(localStorage.getItem(sampleBackupKey));
      if (!previous || !BOARD_PROFILES[previous.board]) throw new Error(t("取り込み前の保存がありません。"));
      replaceFromExchange(previous, true); refreshSamples();
      sampleStatus(t("サンプルを読み込む前のブロックとボード選択に戻しました。"));
    } catch (error) {sampleStatus(error.message, true);}
  });
  $("#loadGcodeSample").addEventListener("click", () => {
    try {
      const json=PicoSamples.plotterflow($("#gcodeSampleBoard").value);
      replaceFromExchange(BlockExchange.parse(JSON.stringify(json),BOARD_PROFILES,boardCatalog),false,sampleBackupKey);
      refreshSamples();
      sampleStatus(t("PlotterFlowサンプルを読み込みました。外付けドライバ・電源・ピン・ペンの可動範囲を確認してください。自動実行はしていません。"));
    } catch(error) {sampleStatus(error.message,true);}
  });
  $("#restoreImport").addEventListener("click", () => {
    try {
      const previous = JSON.parse(localStorage.getItem(backupKey));
      if (!previous || !BOARD_PROFILES[previous.board]) throw new Error(t("取り込み前の保存がありません。"));
      replaceFromExchange(previous, true);
      refreshExchangePrompt();
      exchangeStatus(t("取り込み前のブロックとボード選択に戻しました。"));
    } catch (error) { exchangeStatus(error.message, true); }
  });
  elements.controllerMenuItem.addEventListener("click", openController);
  elements.controllerClose.addEventListener("click", closeController);
  elements.controllerConnect.addEventListener("click", connectController);
  elements.jogCenter.addEventListener("click", centerJog);
  for (const button of document.querySelectorAll("[data-jog-axis]")) {
    button.addEventListener("click", () => jogAxis(button.dataset.jogAxis, Number(button.dataset.jogDirection)));
  }
  document.addEventListener("click", () => setMenuOpen(false));
  let lastJogKey = 0;
  document.addEventListener("keydown", (event) => {
    if ($("#wifiDialog").open) return;
    if (exchangeDialog.open || helpDialog.open || !firstRunGuide.hidden || sampleDialog.open) return;
    if (elements.controllerDrawer.getAttribute("aria-hidden") !== "false") return;
    if (event.target.closest("input, select, textarea, [contenteditable=true]") || event.ctrlKey || event.metaKey || event.altKey) return;
    const commands = PicoJog.keys;
    if (!commands[event.code] && event.code !== "Space") return;
    event.preventDefault();
    if (!controllerActive || isBusy || document.hidden) return;
    if (event.repeat && Date.now() - lastJogKey < 100) return;
    lastJogKey = Date.now();
    if (event.code === "Space") {
      if (!event.repeat) centerJog();
    } else if (commands[event.code]) {
      jogAxis(...commands[event.code]);
    }
  });

  navigator.serial?.addEventListener("disconnect", (event) => {
    if (event.target === port) disconnect();
  });

  window.addEventListener("resize", () => Blockly.svgResize(workspace));
  // Redraw only the editor. No USB reconnect, device command, or program upload.
  function changeLanguage(language) {
    if (isBusy || language === PicoI18n.language) return;
    const state = Blockly.serialization.workspaces.save(workspace);
    const undo = [...workspace.getUndoStack()], redo = [...workspace.getRedoStack()];
    const view = {x: workspace.scrollX, y: workspace.scrollY, scale: workspace.scale};
    const selectedId = Blockly.getSelected()?.id;
    Blockly.Events.disable();
    try {
      PicoI18n.setLanguage(language);
      workspace.getInjectionDiv().setAttribute("aria-label", Blockly.Msg.WORKSPACE_ARIA_LABEL);
      Object.assign(BOARD_PROFILES, createBoardProfiles());
      registerBlocks();
      workspace.updateToolbox(buildToolbox());
      workspace.getToolbox()?.clearSelection();
      workspace.getFlyout()?.hide();
      Blockly.serialization.workspaces.load(state, workspace);
      normalizeWorkspace();
      workspace.getUndoStack().splice(0, Infinity, ...undo);
      workspace.getRedoStack().splice(0, Infinity, ...redo);
      workspace.setScale(view.scale);
      workspace.scroll(view.x, view.y);
      if (selectedId) workspace.getBlockById(selectedId)?.select();
    } finally { Blockly.Events.enable(); }
    PicoI18n.renderDocument(document);
    updateBoardUi();
    setWiringCollapsed(elements.appShell.classList.contains("wiring-collapsed"));
    setBoardMode(boardMode);
    setConnection(port ? "online" : "offline", port ? t("接続済み") : t("未接続"));
    updateControllerConnection();
    updateControllerUi();
    refreshExchangePrompt();
    elements.pythonCode.textContent = generatePython();
    localStorage.setItem("picoblocks-workspace-v1", JSON.stringify(state));
    Blockly.svgResize(workspace);
  }
  $("#languageSelect").addEventListener("change", event => changeLanguage(event.target.value));
  window.addEventListener("beforeunload", () => {
    localStorage.setItem("picoblocks-workspace-v1", JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
  });

  PicoWifi.init({
    changed: () => setConnection(port ? "online" : "offline", port ? t("接続済み") : t("未接続")),
    busy: setBusy, mode: setBoardMode, toast: showToast, closeMenu: () => setMenuOpen(false),
    hasUSB: () => !!port,
    progress: label => setConnection("busy", label),
    install: async (receiver, config) => {
      validateProgram({throwOnError:true});
      controllerActive = false;
      updateControllerConnection();
      showTab("console");
      await executeRaw(PicoWifi.installCommand(receiver, config, generatePython(), bytesLiteral), 20000);
      if (!serialBuffer.includes("PICOBLOCKS_SAVED")) throw new Error(t("保存完了を確認できませんでした。"));
      // No automatic application run during provisioning. Start the write-only receiver.
      serialBuffer = "";
      await writeSource("import _picoblocks_wifi\n_picoblocks_wifi.serve()\n");
      await writeControl(0x04);
      await waitFor("PICOBLOCKS_UPLOAD http://", 30000);
      await waitFor(/PICOBLOCKS_UPLOAD http:\/\/[0-9.]+\r?\n/, 3000);
      setBoardMode("WRITE");
      return serialBuffer.match(/PICOBLOCKS_UPLOAD (http:\/\/[0-9.]+)/)[1];
    },
  });
  loadWorkspace();
  setWiringCollapsed(localStorage.getItem("picoblocks-wiring-collapsed-v1") === "1");
  validateSCS009Pins();
  updateBoardUi();
  elements.pythonCode.textContent = generatePython();
  setConnection("offline", t("未接続"));
  updateControllerConnection();
  updateControllerUi();
})();
